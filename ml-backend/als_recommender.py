import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix


class ALSRecommender:
    """
    Explicit-feedback ALS (Alternating Least Squares) matrix factorization.

    Only observed ratings are fitted; unrated cells are treated as unknown,
    not as zero. Ratings are centred on the global mean and regularization is
    weighted by the number of ratings per user/item (weighted-lambda ALS).
    Predicted rating = global_mean + user_factors[u] . item_factors[i]
    """

    def __init__(self, n_factors=20, regularization=0.1, n_iterations=15, min_item_ratings=3):
        self.n_factors = n_factors
        self.regularization = regularization
        self.n_iterations = n_iterations
        self.min_item_ratings = min_item_ratings
        self.user_factors = None
        self.item_factors = None
        self.global_mean = 0.0
        self.user_map = {}
        self.item_map = {}
        self.reverse_item_map = {}
        self.user_item_matrix = None  # sparse CSR of centred ratings (users x items)
        self.item_rating_counts = None

    def fit(self, ratings_df):
        """
        ratings_df: DataFrame with columns ['userId', 'bookId', 'value']
        """
        if ratings_df.empty:
            return

        df = ratings_df[['userId', 'bookId', 'value']].drop_duplicates(['userId', 'bookId'], keep='last')

        user_codes, unique_users = pd.factorize(df['userId'])
        item_codes, unique_items = pd.factorize(df['bookId'])

        self.user_map = {uid: idx for idx, uid in enumerate(unique_users)}
        self.item_map = {iid: idx for idx, iid in enumerate(unique_items)}
        self.reverse_item_map = {idx: iid for iid, idx in self.item_map.items()}

        n_users = len(unique_users)
        n_items = len(unique_items)

        values = df['value'].to_numpy(dtype=float)
        self.global_mean = float(values.mean())
        centred = values - self.global_mean

        R = csr_matrix((centred, (user_codes, item_codes)), shape=(n_users, n_items))
        R_items = R.T.tocsr()
        self.user_item_matrix = R
        self.item_rating_counts = np.diff(R_items.indptr)

        # Initialize factors with small random values
        rng = np.random.default_rng(42)
        self.user_factors = rng.normal(0, 0.1, (n_users, self.n_factors))
        self.item_factors = rng.normal(0, 0.1, (n_items, self.n_factors))

        # Alternating Least Squares iterations (observed entries only)
        for _ in range(self.n_iterations):
            self._solve_rows(R, self.user_factors, self.item_factors)
            self._solve_rows(R_items, self.item_factors, self.user_factors)

    def _solve_rows(self, matrix, target, fixed):
        """
        For each row r: target[r] = (F_r^T F_r + lambda * n_r * I)^(-1) F_r^T y_r
        where F_r are the fixed factors of the entries observed in that row.
        """
        I = np.eye(self.n_factors)
        for r in range(matrix.shape[0]):
            start, end = matrix.indptr[r], matrix.indptr[r + 1]
            if start == end:
                continue
            cols = matrix.indices[start:end]
            y = matrix.data[start:end]
            F = fixed[cols]
            A = F.T @ F + self.regularization * (end - start) * I
            target[r] = np.linalg.solve(A, F.T @ y)

    def predict(self, user_id, book_id):
        """Predicted rating on the 1-5 scale, or None if user/book is unknown."""
        if user_id not in self.user_map or book_id not in self.item_map:
            return None
        u_idx = self.user_map[user_id]
        i_idx = self.item_map[book_id]
        pred = self.global_mean + self.user_factors[u_idx] @ self.item_factors[i_idx]
        return float(np.clip(pred, 1.0, 5.0))

    def recommend(self, user_id, top_n=10):
        if user_id not in self.user_map or self.user_factors is None:
            return []

        u_idx = self.user_map[user_id]
        user_vector = self.user_factors[u_idx]

        # Predicted ratings for all items: mean + U_u * V^T
        scores = self.global_mean + user_vector @ self.item_factors.T

        # Mask items already rated by this user
        rated_items_indices = self.user_item_matrix[u_idx].indices
        scores[rated_items_indices] = -np.inf

        # Mask items with too few ratings to have reliable factors
        scores[self.item_rating_counts < self.min_item_ratings] = -np.inf

        # Get top_n item indices
        top_indices = np.argsort(scores)[::-1][:top_n]

        recommended_book_ids = []
        for idx in top_indices:
            if scores[idx] != -np.inf:
                recommended_book_ids.append(self.reverse_item_map[idx])

        return recommended_book_ids
