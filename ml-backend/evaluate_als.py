import os
import pandas as pd
import numpy as np
from pymongo import MongoClient
from dotenv import load_dotenv
from als_recommender import ALSRecommender
from sklearn.model_selection import train_test_split

load_dotenv()

def evaluate_als():
    client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017/mind_maze_books"))
    db = client.get_database()
    
    ratings_cursor = db.ratings.find({})
    ratings = list(ratings_cursor)
    
    if not ratings:
        print("No ratings found in MongoDB collection.")
        return

    df = pd.DataFrame(ratings)
    df['userId'] = df['userId'].apply(str)
    df['bookId'] = df['bookId'].apply(str)
    
    print(f"Loaded {len(df)} total user ratings across {df['userId'].nunique()} users and {df['bookId'].nunique()} books.")
    
    # Train-test split (80-20)
    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42)
    
    # Train ALS model
    print("\n--- Training ALS Matrix Factorization Model ---")
    als = ALSRecommender(n_factors=20, regularization=0.1, n_iterations=15)
    als.fit(train_df)
    
    # Calculate RMSE & Accuracy metrics
    squared_errors = []
    hits_at_k = 0
    total_test = 0
    
    for _, row in test_df.iterrows():
        u_id = row['userId']
        b_id = row['bookId']
        true_val = row['value']
        
        pred_val = als.predict(u_id, b_id)
        if pred_val is not None:
            squared_errors.append((true_val - pred_val) ** 2)
            
            # Hit@K evaluation
            recs = als.recommend(u_id, top_n=10)
            if b_id in recs:
                hits_at_k += 1
            total_test += 1

    if not squared_errors:
        print("[!] No test ratings overlap with the trained model; cannot evaluate.")
        return

    rmse = np.sqrt(np.mean(squared_errors))
    hit_rate = hits_at_k / total_test * 100
    accuracy = max(0.0, 100 - (rmse / 5.0 * 100))

    print("\n==================================================")
    print("      ALS MATRIX FACTORIZATION EVALUATION RESULTS ")
    print("==================================================")
    print(f" Algorithm           : ALS (Alternating Least Squares)")
    print(f" Latent Dimensions   : {als.n_factors}")
    print(f" Evaluated Ratings   : {total_test}")
    print(f" Root Mean Sq Error  : {rmse:.4f}")
    print(f" Recommendation Hit@10: {hit_rate:.2f}%")
    print(f" Model Accuracy      : {accuracy:.2f}%")
    print("==================================================\n")

if __name__ == "__main__":
    evaluate_als()
