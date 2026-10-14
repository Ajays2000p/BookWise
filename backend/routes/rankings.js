const express = require('express');
const router = express.Router();
const Rating = require('../models/Rating');
const Book = require('../models/Book');
const mongoose = require('mongoose');
const { getStableMetrics } = require('../utils/bookHelpers');

// In-Memory Server Cache for Ranking Requests
const rankingsCache = new Map();

// Helper to clear cache on rating mutation
const clearRankingsCache = () => {
    rankingsCache.clear();
};

// @route   GET /api/rankings/most-rated
// @desc    Get top 10 most rated books
router.get('/most-rated', async (req, res) => {
    try {
        const cacheKey = 'most-rated';
        if (rankingsCache.has(cacheKey)) {
            return res.json(rankingsCache.get(cacheKey));
        }

        const topRatedBooks = await Rating.aggregate([
            {
                $group: {
                    _id: "$bookId",
                    ratingCount: { $sum: 1 },
                    averageRating: { $avg: "$value" }
                }
            },
            {
                $sort: { ratingCount: -1 }
            },
            {
                $limit: 10
            },
            {
                $lookup: {
                    from: "books", // Should match the collection name in MongoDB
                    localField: "_id",
                    foreignField: "_id",
                    as: "bookDetails"
                }
            },
            {
                $unwind: "$bookDetails"
            },
            {
                $project: {
                    _id: 1,
                    ratingCount: 1,
                    averageRating: { $round: ["$averageRating", 1] },
                    title: "$bookDetails.title",
                    author: "$bookDetails.author",
                    thumbnailUrl: "$bookDetails.thumbnailUrl",
                    realCoverImage: "$bookDetails.realCoverImage",
                    genres: "$bookDetails.genres"
                }
            }
        ]);

        rankingsCache.set(cacheKey, topRatedBooks);
        res.json(topRatedBooks);
    } catch (error) {
        console.error('Error fetching most rated books:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/rankings/top-rated
// @desc    Get books sorted dynamically by highest average rating, with optional genre filter or multi-genre filter
router.get('/top-rated', async (req, res) => {
    try {
        const { genre, multiGenre, limit } = req.query;
        const targetLimit = parseInt(limit, 10) || 25;
        const cacheKey = `top-rated:${genre || ''}:${multiGenre || ''}:${targetLimit}`;

        if (rankingsCache.has(cacheKey)) {
            return res.json(rankingsCache.get(cacheKey));
        }

        // Build filter for genre constraints
        let genreFilter = {};
        if (multiGenre === 'true') {
            genreFilter = { "genres.1": { $exists: true } };
        } else if (genre) {
            genreFilter = { "genres": { $size: 1, $all: [genre] } };
        } else {
            genreFilter = { "genres": { $size: 1 } };
        }

        // 1. Fetch matching books with field selection (projection).
        //    Covers are large inline images, so they are loaded later for the returned books only.
        const books = await Book.find(genreFilter)
            .select('_id title author genres rating ratingCount')
            .lean();

        // 2. Aggregate live user ratings from Rating collection
        const ratingAgg = await Rating.aggregate([
            {
                $group: {
                    _id: "$bookId",
                    ratingCount: { $sum: 1 },
                    averageRating: { $avg: "$value" }
                }
            }
        ]);

        const ratingMap = new Map();
        ratingAgg.forEach(r => {
            ratingMap.set(r._id.toString(), {
                averageRating: Math.round(r.averageRating * 10) / 10,
                ratingCount: r.ratingCount
            });
        });

        // 3. Enrich each book with dynamic ratings from MongoDB
        let enrichedBooks = books.map(book => {
            const idStr = book._id.toString();
            const agg = ratingMap.get(idStr);

            let finalRating = 0;
            let finalCount = 0;

            if (agg && agg.ratingCount > 0) {
                finalRating = agg.averageRating;
                finalCount = agg.ratingCount;
            } else if (book.rating && book.rating > 0) {
                finalRating = Math.round(book.rating * 10) / 10;
                finalCount = book.ratingCount || 1;
            } else {
                const metrics = getStableMetrics(book._id);
                finalRating = metrics.rating;
                finalCount = metrics.ratingCount;
            }

            return {
                _id: book._id,
                title: book.title,
                author: book.author,
                genres: book.genres,
                averageRating: finalRating,
                ratingCount: finalCount
            };
        });

        // 4. Apply ratingCount filters and sorting based on carousel type (Option A: Highest Star Score First)
        if (multiGenre === 'true') {
            // Multi-genre books: ratingCount between 24 and 29 inclusive
            enrichedBooks = enrichedBooks.filter(b => b.ratingCount >= 24 && b.ratingCount <= 29);
        } else {
            // Single-genre books: ratingCount between 36 and 53 inclusive
            enrichedBooks = enrichedBooks.filter(b => b.ratingCount >= 36 && b.ratingCount <= 53);
        }

        // Sort primarily by averageRating (descending), tie-breaker ratingCount (descending)
        enrichedBooks.sort((a, b) => {
            if (b.averageRating !== a.averageRating) {
                return b.averageRating - a.averageRating;
            }
            return b.ratingCount - a.ratingCount;
        });

        // 6. Return top books
        const top = enrichedBooks.slice(0, targetLimit);
        const covers = await Book.find({ _id: { $in: top.map(b => b._id) } })
            .select('_id thumbnailUrl realCoverImage')
            .lean();
        const coverById = new Map(covers.map(c => [c._id.toString(), c]));
        const result = top.map(b => {
            const cover = coverById.get(b._id.toString());
            return { ...b, thumbnailUrl: cover?.thumbnailUrl, realCoverImage: cover?.realCoverImage };
        });
        rankingsCache.set(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('Error fetching top rated books:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
module.exports.clearRankingsCache = clearRankingsCache;
