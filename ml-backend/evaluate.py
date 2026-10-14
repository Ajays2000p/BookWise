import os
import pandas as pd
import numpy as np
from pymongo import MongoClient
from sklearn.model_selection import train_test_split
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.metrics import mean_squared_error, mean_absolute_error
from dotenv import load_dotenv

load_dotenv()

def evaluate_recommendation_system():
    print("=" * 55)
    print("      MINDMAZE BOOKS - RECOMMENDATION EVALUATION     ")
    print("=" * 55)
    
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/mind_maze_books")
    client = MongoClient(mongo_uri)
    db = client.get_database()
    
    ratings_list = list(db.ratings.find({}, {"_id": 0, "userId": 1, "bookId": 1, "value": 1}))
    
    if not ratings_list:
        print("\n[ERROR] No ratings found in MongoDB to evaluate.")
        return
        
    df = pd.DataFrame(ratings_list)
    df['userId'] = df['userId'].astype(str)
    df['bookId'] = df['bookId'].astype(str)
    
    print(f"[*] Total Ratings in Database: {len(df)}")
    print(f"[*] Total Unique Users: {df['userId'].nunique()}")
    print(f"[*] Total Unique Books: {df['bookId'].nunique()}")
    
    if len(df) < 20:
        print("\n[WARNING] Dataset too small for 80/20 train/test split evaluation.")
        return

    # Train / Test 80-20 Split
    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42)
    
    print(f"[*] Training Ratings: {len(train_df)} | Test Ratings: {len(test_df)}")
    
    # Build User-Item Matrix from Train set
    user_item_matrix = train_df.pivot_table(index='userId', columns='bookId', values='value').fillna(0)
    
    # Calculate User-User Cosine Similarity
    user_sim = cosine_similarity(user_item_matrix)
    user_sim_df = pd.DataFrame(user_sim, index=user_item_matrix.index, columns=user_item_matrix.index)
    
    user_item_vals = user_item_matrix.values
    rated_mask = (user_item_vals > 0).astype(float)
    
    weights_sum = np.dot(user_sim, rated_mask)
    no_neighbours = weights_sum == 0
    weights_sum[no_neighbours] = 1.0
    
    pred_matrix = np.dot(user_sim, user_item_vals) / weights_sum
    
    # Global mean rating fallback for cells no similar user has rated
    global_mean = train_df['value'].mean()
    pred_matrix[no_neighbours] = global_mean
    
    pred_df = pd.DataFrame(pred_matrix, index=user_item_matrix.index, columns=user_item_matrix.columns)
    
    # Match test ratings against predicted matrix
    eval_df = test_df[(test_df['userId'].isin(pred_df.index)) & (test_df['bookId'].isin(pred_df.columns))].copy()
    
    if eval_df.empty:
        print("[!] Not enough overlap in test split to evaluate user similarity.")
        return

    eval_df['pred'] = eval_df.apply(lambda r: pred_df.loc[r['userId'], r['bookId']], axis=1)
    
    y_true = eval_df['value'].values
    y_pred = eval_df['pred'].values
    
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    
    # Precision@10: Fraction of predicted high ratings (>= 3.5) among actual high ratings (>= 4.0)
    high_actual = eval_df[eval_df['value'] >= 4.0]
    hits = (high_actual['pred'] >= 3.5).sum()
    precision_k = (hits / len(high_actual) * 100) if len(high_actual) > 0 else None
    
    accuracy_score = max(0.0, min(100.0, (1.0 - (rmse / 5.0)) * 100))

    print("\n" + "=" * 55)
    print("            RECOMMENDATION SYSTEM METRICS           ")
    print("=" * 55)
    print(f"  1. RMSE (Root Mean Square Error) : {rmse:.4f} (Lower is better)")
    print(f"  2. MAE (Mean Absolute Error)     : {mae:.4f} (Lower is better)")
    print(f"  3. High-Rating Recall (>=4 predicted >=3.5) : " + (f"{precision_k:.2f}%" if precision_k is not None else "n/a"))
    print(f"  4. Overall Model Accuracy Score  : {accuracy_score:.2f}%")
    print("=" * 55)

if __name__ == '__main__':
    evaluate_recommendation_system()
