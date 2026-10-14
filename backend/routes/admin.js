const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');
const Book = require('../models/Book');
const Rating = require('../models/Rating');
const { clearBookDetailCache } = require('./books');
const { clearRankingsCache } = require('./rankings');
const { toCsv } = require('../utils/analyticsReport');

// Get Global Stats
router.get('/stats', [auth, admin], async (req, res) => {
    try {
        const [totalUsers, totalBooks, totalRatings, books, ratingDistributionAgg, ratingsPerBook] = await Promise.all([
            User.countDocuments({ isAdmin: { $ne: true } }),
            Book.countDocuments(),
            Rating.countDocuments(),
            Book.find({}, 'genres').lean(),
            Rating.aggregate([
                { $group: { _id: "$value", count: { $sum: 1 } } }
            ]),
            Rating.aggregate([
                { $group: { _id: "$bookId", count: { $sum: 1 } } }
            ])
        ]);

        // Genre Distribution (Books per genre)
        const genreCounts = {};
        books.forEach(b => {
            if (b.genres) {
                b.genres.forEach(g => {
                    genreCounts[g] = (genreCounts[g] || 0) + 1;
                });
            }
        });

        const genreData = Object.keys(genreCounts).map(name => ({
            name,
            count: genreCounts[name]
        })).sort((a, b) => b.count - a.count).slice(0, 6);

        // 1. Rating Distribution (1★ to 5★)
        const ratingCountsMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratingDistributionAgg.forEach(item => {
            if (ratingCountsMap[item._id] !== undefined) {
                ratingCountsMap[item._id] = item.count;
            }
        });
        const ratingDistribution = Object.keys(ratingCountsMap).map(star => ({
            stars: `${star}★`,
            count: ratingCountsMap[star]
        }));

        // 2. Most Popular Genres based on number of ratings
        //    (rating counts per book, credited to each of the book's genres)
        const genresByBookId = new Map(books.map(b => [b._id.toString(), b.genres]));
        const popularGenreCounts = {};
        ratingsPerBook.forEach(r => {
            const genres = genresByBookId.get(String(r._id));
            if (genres) {
                genres.forEach(g => {
                    popularGenreCounts[g] = (popularGenreCounts[g] || 0) + r.count;
                });
            }
        });

        // Fallback to book genre counts if no ratings yet
        const genreCountsSource = Object.keys(popularGenreCounts).length > 0 ? popularGenreCounts : genreCounts;
        const popularGenres = Object.keys(genreCountsSource).map(name => ({
            name,
            count: genreCountsSource[name]
        })).sort((a, b) => b.count - a.count).slice(0, 8);

        // 4 (threshold). Highest rated needs a reasonable min rating count
        const booksWithThreeRatings = ratingsPerBook.filter(r => r.count >= 3).length;
        const minRatingThreshold = booksWithThreeRatings >= 5 ? 3 : 1;

        // 3 & 4 are independent, so run both aggregations together
        const [mostRatedAgg, highestRatedAgg] = await Promise.all([
            // 3. Top 10 Most Rated Books (using application user ratings from Rating collection)
            Rating.aggregate([
                {
                    $group: {
                        _id: "$bookId",
                        ratingCount: { $sum: 1 },
                        avgRating: { $avg: "$value" }
                    }
                },
                { $sort: { ratingCount: -1, avgRating: -1 } },
                { $limit: 10 }
            ]),
            // 4. Top 10 Highest Rated Books (using application user ratings with reasonable min rating count)
            Rating.aggregate([
                {
                    $group: {
                        _id: "$bookId",
                        ratingCount: { $sum: 1 },
                        avgRating: { $avg: "$value" }
                    }
                },
                { $match: { ratingCount: { $gte: minRatingThreshold } } },
                { $sort: { avgRating: -1, ratingCount: -1 } },
                { $limit: 10 }
            ])
        ]);

        const mostRatedBookIds = mostRatedAgg.map(item => item._id);
        const booksMap = {};
        if (mostRatedBookIds.length > 0) {
            const books = await Book.find({ _id: { $in: mostRatedBookIds } }).select('title author thumbnailUrl');
            books.forEach(b => {
                booksMap[b._id.toString()] = b;
            });
        }

        const mostRatedBooks = mostRatedAgg.map(item => {
            const book = booksMap[item._id.toString()];
            return {
                id: item._id,
                title: book ? book.title : "Unknown Title",
                author: book ? book.author : "Unknown Author",
                coverUrl: book ? book.thumbnailUrl : "",
                rating: item.avgRating ? Number(item.avgRating.toFixed(1)) : 0,
                ratingCount: item.ratingCount
            };
        });

        const highestRatedBookIds = highestRatedAgg.map(item => item._id);
        if (highestRatedBookIds.length > 0) {
            const books = await Book.find({ _id: { $in: highestRatedBookIds } }).select('title author thumbnailUrl');
            books.forEach(b => {
                booksMap[b._id.toString()] = b;
            });
        }

        const highestRatedBooks = highestRatedAgg.map(item => {
            const book = booksMap[item._id.toString()];
            return {
                id: item._id,
                title: book ? book.title : "Unknown Title",
                author: book ? book.author : "Unknown Author",
                coverUrl: book ? book.thumbnailUrl : "",
                rating: item.avgRating ? Number(item.avgRating.toFixed(1)) : 0,
                ratingCount: item.ratingCount
            };
        });

        res.json({
            totalUsers,
            totalBooks,
            totalRatings,
            genreData,
            ratingDistribution,
            popularGenres,
            mostRatedBooks,
            highestRatedBooks
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Export Analytics as CSV
router.get('/export-analytics', [auth, admin], async (req, res) => {
    try {
        // Only accept YYYY-MM-DD, since the date also goes into the download filename header
        const dateParam = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '')
            ? req.query.date
            : new Date().toISOString().split('T')[0];

        // 1. Get Global Stats
        const totalUsers = await User.countDocuments({ isAdmin: { $ne: true } });
        const totalBooks = await Book.countDocuments();
        const totalRatings = await Rating.countDocuments();

        // 2. Most Popular Genres based on number of ratings
        //    (rating counts per book, credited to each of the book's genres)
        const [books, ratingsPerBook] = await Promise.all([
            Book.find({}, 'genres').lean(),
            Rating.aggregate([
                { $group: { _id: "$bookId", count: { $sum: 1 } } }
            ])
        ]);
        const genresByBookId = new Map(books.map(b => [b._id.toString(), b.genres]));
        const popularGenreCounts = {};
        ratingsPerBook.forEach(r => {
            const genres = genresByBookId.get(String(r._id));
            if (genres) {
                genres.forEach(g => {
                    popularGenreCounts[g] = (popularGenreCounts[g] || 0) + r.count;
                });
            }
        });
        const popularGenres = Object.keys(popularGenreCounts).map(name => ({
            genre: name,
            ratingCount: popularGenreCounts[name]
        })).sort((a, b) => b.ratingCount - a.ratingCount || a.genre.localeCompare(b.genre));

        // 3. Top 10 Most Rated Books
        const mostRatedAgg = await Rating.aggregate([
            { $group: { _id: "$bookId", ratingCount: { $sum: 1 }, avgRating: { $avg: "$value" } } },
            { $sort: { ratingCount: -1, avgRating: -1 } },
            { $limit: 10 }
        ]);

        const mostRatedBookIds = mostRatedAgg.map(item => item._id);
        const booksMap = {};
        if (mostRatedBookIds.length > 0) {
            const books = await Book.find({ _id: { $in: mostRatedBookIds } }).select('title author thumbnailUrl');
            books.forEach(b => { booksMap[b._id.toString()] = b; });
        }

        const mostRatedBooks = mostRatedAgg.map((item, idx) => {
            const book = booksMap[item._id.toString()];
            return { rank: idx + 1, title: book ? book.title : "Unknown Title", author: book ? book.author : "Unknown Author", ratingCount: item.ratingCount };
        });

        // 4. Top 10 Highest Rated Books
        const ratingCountsByBook = await Rating.aggregate([
            { $group: { _id: "$bookId", ratingCount: { $sum: 1 } } },
            { $match: { ratingCount: { $gte: 3 } } },
            { $count: "count" }
        ]);
        const minRatingThreshold = (ratingCountsByBook[0]?.count || 0) >= 5 ? 3 : 1;

        const highestRatedAgg = await Rating.aggregate([
            { $group: { _id: "$bookId", ratingCount: { $sum: 1 }, avgRating: { $avg: "$value" } } },
            { $match: { ratingCount: { $gte: minRatingThreshold } } },
            { $sort: { avgRating: -1, ratingCount: -1 } },
            { $limit: 10 }
        ]);

        const highestRatedBookIds = highestRatedAgg.map(item => item._id);
        if (highestRatedBookIds.length > 0) {
            const books = await Book.find({ _id: { $in: highestRatedBookIds } }).select('title author thumbnailUrl');
            books.forEach(b => { booksMap[b._id.toString()] = b; });
        }

        const highestRatedBooks = highestRatedAgg.map((item, idx) => {
            const book = booksMap[item._id.toString()];
            return { rank: idx + 1, title: book ? book.title : "Unknown Title", author: book ? book.author : "Unknown Author", averageRating: item.avgRating ? Number(item.avgRating.toFixed(1)) : 0 };
        });

        const reportData = { totalUsers, totalBooks, totalRatings, popularGenres, mostRatedBooks, highestRatedBooks };

        // Set headers for download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=BookWise_Analytics_' + dateParam + '.csv');
        res.send(toCsv(reportData, dateParam));
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get All Users
router.get('/users', [auth, admin], async (req, res) => {
    try {
        const users = await User.find({ isAdmin: { $ne: true } }).select('-password');
        
        // Efficiently aggregate rating counts for all users in one query
        const ratingCounts = await Rating.aggregate([
            { $group: { _id: "$userId", count: { $sum: 1 } } }
        ]);

        // Create a map for quick lookup
        const countsMap = {};
        ratingCounts.forEach(item => {
            countsMap[item._id.toString()] = item.count;
        });

        const enrichedUsers = users.map(u => ({
            id: u._id,
            name: u.name,
            email: u.email,
            isAdmin: u.isAdmin,
            ratings: countsMap[u._id.toString()] || 0,
            createdAt: u.createdAt
        }));

        res.json(enrichedUsers);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete a Rating
router.delete('/ratings/:id', [auth, admin], async (req, res) => {
    try {
        const rating = await Rating.findById(req.params.id);
        if (!rating) return res.status(404).json({ message: 'Rating not found' });

        const bookId = rating.bookId;
        await Rating.findByIdAndDelete(req.params.id);

        // Recalculate book average
        const allRatings = await Rating.find({ bookId });
        const count = allRatings.length;
        const avg = count > 0 ? allRatings.reduce((acc, curr) => acc + curr.value, 0) / count : 0;

        await Book.findByIdAndUpdate(bookId, {
            rating: parseFloat(avg.toFixed(1)),
            ratingCount: count
        });

        if (typeof clearRankingsCache === 'function') clearRankingsCache();
        if (typeof clearBookDetailCache === 'function') clearBookDetailCache(bookId);

        res.json({ message: 'Rating removed' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

const { getUserAnalyticsHelper } = require('../utils/userAnalytics');

// Get Specific User Analytics for Admin
router.get('/users/:userId/analytics', [auth, admin], async (req, res) => {
    try {
        const data = await getUserAnalyticsHelper(req.params.userId);
        if (!data) return res.status(404).json({ message: 'User not found' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
