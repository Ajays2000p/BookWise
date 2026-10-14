import os
import threading
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from pymongo import MongoClient
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from dotenv import load_dotenv
from bson import ObjectId
from bson.errors import InvalidId

from als_recommender import ALSRecommender

load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB Connection
client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017/mind_maze_books"))
db = client.get_database()

BOOK_CARD_FIELDS = {"_id": 1, "title": 1, "author": 1, "genres": 1, "rating": 1, "ratingCount": 1, "thumbnailUrl": 1, "realCoverImage": 1}

def load_ratings_df():
    df = pd.DataFrame(list(db.ratings.find({}, {"_id": 0, "userId": 1, "bookId": 1, "value": 1})))
    if df.empty:
        return df
    df['userId'] = df['userId'].apply(str)
    df['bookId'] = df['bookId'].apply(str)
    return df

def fetch_books_in_order(book_ids, extra_fields=None):
    """Load books by id, preserving the ranking order of book_ids."""
    if not book_ids:
        return []
    books = list(db.books.find({"_id": {"$in": [ObjectId(bid) for bid in book_ids]}}, BOOK_CARD_FIELDS))
    by_id = {str(b['_id']): b for b in books}
    ordered = []
    for bid in book_ids:
        book = by_id.get(bid)
        if book:
            book['_id'] = bid
            book.update(extra_fields or {})
            ordered.append(book)
    return ordered

# Home page sections are identical for every visitor, so cache them briefly
SECTION_CACHE_SECONDS = 60
_section_cache = {}

def cached_section(fn, limit):
    key = (fn.__name__, limit)
    hit = _section_cache.get(key)
    if hit and time.time() - hit[0] < SECTION_CACHE_SECONDS:
        return hit[1]
    value = fn(limit)
    _section_cache[key] = (time.time(), value)
    return value

# Ranking only needs numeric fields; covers (large inline images) are loaded
# afterwards for the few books actually returned.
def get_weighted_rating_books(limit=10):
    books = list(db.books.find({}, {"_id": 1, "rating": 1, "ratingCount": 1}))
    if not books: return []

    df = pd.DataFrame(books)
    C = df['rating'].mean()
    m = df['ratingCount'].quantile(0.75)

    # Weighted rating: (v/(v+m) * R) + (m/(m+v) * C)
    v = df['ratingCount']
    df['score'] = (v / (v + m) * df['rating']) + (m / (m + v) * C)
    df = df.sort_values('score', ascending=False)

    top_ids = [str(bid) for bid in df.head(limit)['_id']]
    return fetch_books_in_order(top_ids, {"recommendationReason": "Most highly recommended by readers"})

def get_new_releases(limit=10):
    books = list(db.books.find({}, {"_id": 1, "rating": 1, "ratingCount": 1, "createdAt": 1}))
    if not books: return []

    # Get live rating counts from ratings collection
    ratings_cursor = db.ratings.aggregate([
        {"$group": {"_id": "$bookId", "count": {"$sum": 1}, "avg": {"$avg": "$value"}}}
    ])

    rating_map = {}
    for r in ratings_cursor:
        rating_map[str(r["_id"])] = {
            "count": r["count"],
            "avg": round(r["avg"], 1)
        }

    enriched_books = []
    for book in books:
        bid = str(book["_id"])
        agg = rating_map.get(bid)

        count = agg["count"] if agg else book.get("ratingCount", 0)
        avg = agg["avg"] if agg else book.get("rating", 0)

        # Requirement: ratingCount >= 2 and ratingCount <= 9
        if 2 <= count <= 9:
            book["_id"] = bid
            book["ratingCount"] = count
            book["rating"] = avg
            enriched_books.append(book)

    # Sort by createdAt descending (newest created date first)
    enriched_books.sort(key=lambda x: str(x.get("createdAt") or ""), reverse=True)
    newest = enriched_books[:limit]

    full_books = fetch_books_in_order([b["_id"] for b in newest], {"recommendationReason": "Newly added to our library"})
    stats = {b["_id"]: b for b in newest}
    for book in full_books:
        s = stats[book["_id"]]
        book["ratingCount"] = s["ratingCount"]
        book["rating"] = s["rating"]
        book["averageRating"] = s["rating"]
        book["createdAt"] = s.get("createdAt")
    return full_books

def get_user_based_recommendation_ids(user_id, limit=10):
    """User-based collaborative filtering with cosine similarity (top-5 neighbours)."""
    try:
        df = load_ratings_df()
        if len(df) < 10: return []

        user_item_matrix = df.pivot_table(index='userId', columns='bookId', values='value').fillna(0)
        if user_id not in user_item_matrix.index: return []

        user_sim = cosine_similarity(user_item_matrix)
        user_sim_df = pd.DataFrame(user_sim, index=user_item_matrix.index, columns=user_item_matrix.index)

        similar_users = user_sim_df[user_id].drop(user_id).sort_values(ascending=False).head(5).index.tolist()

        recommended_book_ids = []
        user_rated_books = set(df[df['userId'] == user_id]['bookId'].tolist())

        for sim_user in similar_users:
            sim_user_ratings = df[(df['userId'] == sim_user) & (df['value'] >= 4)].sort_values(by='value', ascending=False)
            for _, row in sim_user_ratings.iterrows():
                if row['bookId'] not in user_rated_books and row['bookId'] not in recommended_book_ids:
                    recommended_book_ids.append(row['bookId'])
                if len(recommended_book_ids) >= limit: break
            if len(recommended_book_ids) >= limit: break

        return recommended_book_ids
    except Exception as e:
        print(f"User CF Error: {e}")
        return []

# ─────────────────────────────────────────────────────────
# ALS model cache: trained once, retrained in the background when ratings change
# ─────────────────────────────────────────────────────────

_train_lock = threading.Lock()
_model_state = {"model": None, "signature": None}

def _ratings_signature():
    latest = db.ratings.find_one({}, {"updatedAt": 1}, sort=[("updatedAt", -1)])
    return (db.ratings.count_documents({}), latest.get("updatedAt") if latest else None)

def _train_als(signature):
    df = load_ratings_df()
    model = None
    if len(df) >= 5:
        model = ALSRecommender(n_factors=20, regularization=0.1, n_iterations=15)
        model.fit(df)
    _model_state.update(model=model, signature=signature)
    print(f"ALS model trained on {len(df)} ratings")

def _retrain_in_background(signature):
    if not _train_lock.acquire(blocking=False):
        return  # a training run is already in progress

    def run():
        try:
            _train_als(signature)
        except Exception as e:
            print(f"ALS retrain error: {e}")
        finally:
            _train_lock.release()

    threading.Thread(target=run, daemon=True).start()

def get_als_model():
    signature = _ratings_signature()
    if _model_state["signature"] is None:
        with _train_lock:
            if _model_state["signature"] is None:
                _train_als(signature)
    elif _model_state["signature"] != signature:
        # Serve the current model while a fresh one trains
        _retrain_in_background(signature)
    return _model_state["model"]

def get_als_recommendation_ids(user_id, limit=10):
    try:
        model = get_als_model()
        return model.recommend(user_id, top_n=limit) if model else []
    except Exception as e:
        print(f"ALS CF Error: {e}")
        return []

def get_personalized_recommendation_ids(user_id, limit=10):
    """ALS first; user-based cosine CF as fallback. Returns (algorithm, book_ids)."""
    book_ids = get_als_recommendation_ids(user_id, limit)
    if book_ids:
        return "ALS", book_ids
    book_ids = get_user_based_recommendation_ids(user_id, limit)
    if book_ids:
        return "UserCF", book_ids
    return None, []

REASONS = {
    "ALS": "Recommended via ALS Collaborative Filtering",
    "UserCF": "Recommended based on similar readers",
}

def get_content_based_recommendations(book_id, limit=6):
    """Similar books by genre overlap (Jaccard) and shared author."""
    target = db.books.find_one({"_id": ObjectId(book_id)}, {"genres": 1, "author": 1})
    if not target:
        return None

    target_genres = set(target.get("genres") or [])
    author = target.get("author")
    or_clauses = []
    if target_genres:
        or_clauses.append({"genres": {"$in": list(target_genres)}})
    if author:
        or_clauses.append({"author": author})
    if not or_clauses:
        return []

    candidates = db.books.find({"_id": {"$ne": target["_id"]}, "$or": or_clauses}, BOOK_CARD_FIELDS)

    scored = []
    for book in candidates:
        genres = set(book.get("genres") or [])
        union = target_genres | genres
        jaccard = len(target_genres & genres) / len(union) if union else 0.0
        same_author = 1.0 if author and book.get("author") == author else 0.0
        score = 0.7 * jaccard + 0.3 * same_author
        if score > 0:
            book['_id'] = str(book['_id'])
            book['similarityScore'] = round(score * 100)
            book['recommendationReason'] = "Similar genres and author"
            scored.append(book)

    scored.sort(key=lambda b: (b['similarityScore'], b.get('rating') or 0, b.get('ratingCount') or 0), reverse=True)
    return scored[:limit]

@app.route('/api/recommendations', methods=['GET'])
def get_hybrid_recommendations():
    user_id = request.args.get('userId')

    response = {
        "mostRecommended": cached_section(get_weighted_rating_books, 10),
        "newArrivals": cached_section(get_new_releases, 10)
    }

    if user_id:
        algorithm, book_ids = get_personalized_recommendation_ids(user_id, 10)
        response["personalized"] = fetch_books_in_order(book_ids, {"recommendationReason": REASONS.get(algorithm)})
        response["personalizedAlgorithm"] = algorithm

    return jsonify(response)

@app.route('/api/recommend/personalized', methods=['GET'])
def recommend_personalized():
    user_id = request.args.get('userId')
    limit = int(request.args.get('limit', 10))
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    algorithm, book_ids = get_personalized_recommendation_ids(user_id, limit)
    return jsonify({
        "userId": user_id,
        "algorithm": algorithm,
        "bookIds": book_ids
    })

@app.route('/api/recommend/als', methods=['GET'])
def recommend_als():
    user_id = request.args.get('userId')
    limit = int(request.args.get('limit', 10))
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    book_ids = get_als_recommendation_ids(user_id, limit)
    return jsonify({
        "userId": user_id,
        "algorithm": "ALS Matrix Factorization",
        "recommendations": fetch_books_in_order(book_ids, {"recommendationReason": REASONS["ALS"]})
    })

@app.route('/api/recommend/content', methods=['GET'])
def recommend_content():
    book_id = request.args.get('bookId')
    limit = int(request.args.get('limit', 6))
    if not book_id:
        return jsonify({"error": "bookId required"}), 400
    try:
        books = get_content_based_recommendations(book_id, limit)
    except InvalidId:
        return jsonify({"error": "invalid bookId"}), 400
    if books is None:
        return jsonify({"error": "book not found"}), 404
    return jsonify(books)

@app.route('/api/recommend/popularity', methods=['GET'])
def recommend_popularity():
    limit = int(request.args.get('limit', 10))
    books = list(db.books.find({}).sort("popularityScore", -1).limit(limit))
    for book in books:
        book['_id'] = str(book['_id'])
    return jsonify(books)

if __name__ == '__main__':
    # Warm the ALS model in the reloader's serving process so the first request is fast
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        threading.Thread(target=get_als_model, daemon=True).start()
    app.run(port=5000, debug=True)
