/**
 * utils/recommendationHelpers.js
 * Bridges the Node personalized-recommendations route to the Flask ML service
 * (ALS with user-based cosine CF fallback).
 */

const ML_BASE_URL = process.env.ML_BASE_URL || 'http://127.0.0.1:5000/api';

// Users with fewer ratings than this get genre-based (cold start) recommendations only
const ML_MIN_RATINGS = 5;
const ML_TIMEOUT_MS = 5000;

/**
 * Ask the ML service for ranked book ids for a user.
 * Resolves to { algorithm, bookIds } or null when the service is unavailable.
 */
const fetchMlRecommendationIds = async (userId, limit, fetchImpl = fetch) => {
    try {
        const url = `${ML_BASE_URL}/recommend/personalized?userId=${encodeURIComponent(userId)}&limit=${limit}`;
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(ML_TIMEOUT_MS) });
        if (!res.ok) return null;

        const data = await res.json();
        if (!data.algorithm || !Array.isArray(data.bookIds)) return null;
        return { algorithm: data.algorithm, bookIds: data.bookIds.map(String) };
    } catch (err) {
        console.error('ML service unavailable, using genre-based recommendations:', err.message);
        return null;
    }
};

/**
 * Put ML-ranked books first, then fill remaining slots from genre-scored books.
 * Only books present in scoredBooks (i.e. not rated / not-interested) are eligible.
 */
const mergeRecommendations = (mlBookIds, scoredBooks, limit) => {
    const byId = new Map(scoredBooks.map(b => [String(b._id), b]));
    const picked = new Set();
    const books = [];

    for (const id of mlBookIds || []) {
        if (books.length >= limit) break;
        const book = byId.get(id);
        if (book && !picked.has(id)) {
            picked.add(id);
            books.push(book);
        }
    }
    const mlCount = books.length;

    for (const book of scoredBooks) {
        if (books.length >= limit) break;
        const id = String(book._id);
        if (!picked.has(id)) {
            picked.add(id);
            books.push(book);
        }
    }

    return { books, mlCount };
};

module.exports = { ML_MIN_RATINGS, fetchMlRecommendationIds, mergeRecommendations };
