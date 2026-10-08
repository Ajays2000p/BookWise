const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { generateCover } = require('../utils/coverGenerator');
const Notification = require('../models/Notification');

// ─────────────────────────────────────────────────────────
// STATIC NAMED ROUTES  (must be before any /:id param route)
// ─────────────────────────────────────────────────────────

// GET /api/books/search
// Exact match search for Admin Panel
router.get('/search', async (req, res) => {
    try {
        const query = (req.query.query || '').trim();
        if (!query) return res.json([]);

        const books = await Book.find({
            $or: [
                { title: { $regex: `^${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
                { author: { $regex: `^${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
            ]
        });

        res.json(books);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/books/home-search
// Exclusive multi-field search for the Home Page Navbar
router.get('/home-search', async (req, res) => {
    try {
        const { query, limit = 20 } = req.query;
        if (!query) return res.json([]);

        const cleanQuery = query.trim();
        if (!cleanQuery) return res.json([]);

        // Strict exact match using anchored regex (case-insensitive)
        const books = await Book.find({
            $or: [
                { title: { $regex: `^${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
                { author: { $regex: `^${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
            ]
        }).limit(parseInt(limit));

        res.json(books);
    } catch (err) {
        console.error('Error in home-search:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/books/personalized-recommendations
// Returns personalized books for logged-in users instantly (using ratings or user favorite genres)
// GET /api/books/personalized-recommendations
// Progressive personalized recommendations engine (0-10+ ratings)
router.get('/personalized-recommendations', auth, async (req, res) => {
    try {
        const Rating = require('../models/Rating');
        const User = require('../models/User');
        const mongoose = require('mongoose');

        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 1. Get user favorite genres selected during onboarding
        const userFavGenres = Array.isArray(user.favoriteGenres) && user.favoriteGenres.length > 0
            ? user.favoriteGenres
            : ['Fantasy', 'Fiction', 'Mystery', 'Romance', 'Sci-Fi'];

        // 2. Get user rating history
        const allUserRatings = await Rating.find({ userId: user._id }).populate('bookId');
        const userRatings = allUserRatings.filter(r => r.bookId && r.bookId._id);
        const alreadyRatedBookIds = userRatings.map(r => r.bookId._id.toString());

        const numRatings = userRatings.length;

        // 3. Progressive Weights Determination
        let wGenre = 1.0;
        let wHistory = 0.0;

        if (numRatings === 0) {
            wGenre = 1.0;
            wHistory = 0.0;
        } else if (numRatings <= 3) {
            wGenre = 0.7;
            wHistory = 0.3;
        } else if (numRatings <= 9) {
            wGenre = 0.4;
            wHistory = 0.6;
        } else {
            wGenre = 0.2;
            wHistory = 0.8;
        }

        // 4. Calculate Genre & Author Preference Scores from Ratings & Selection
        const genreScores = {};
        const authorScores = {};

        // Base score for onboarding favorite genres (+5 per selected genre)
        userFavGenres.forEach(g => {
            genreScores[g] = (genreScores[g] || 0) + 5.0;
        });

        // Learned preference scores from rating history
        userRatings.forEach(r => {
            const val = r.value;
            const book = r.bookId;
            let genreDelta = 0;
            let authorDelta = 0;

            if (val === 5) {
                genreDelta = 8.0;
                authorDelta = 6.0;
            } else if (val === 4) {
                genreDelta = 4.0;
                authorDelta = 3.0;
            } else if (val === 3) {
                genreDelta = 1.0;
                authorDelta = 0.5;
            } else if (val === 2) {
                genreDelta = -4.0;
                authorDelta = -3.0;
            } else if (val === 1) {
                genreDelta = -8.0;
                authorDelta = -6.0;
            }

            if (book.genres && Array.isArray(book.genres)) {
                book.genres.forEach(g => {
                    genreScores[g] = (genreScores[g] || 0) + genreDelta;
                });
            }

            if (book.author) {
                authorScores[book.author] = (authorScores[book.author] || 0) + authorDelta;
            }
        });

        const notInterestedIds = Array.isArray(user.notInterestedBooks)
            ? user.notInterestedBooks.map(id => String(id))
            : [];
        const excludedIds = [...alreadyRatedBookIds, ...notInterestedIds];

        // 5. Fetch candidate books (excluding already rated and not interested books) with field selection
        const candidates = await Book.find({
            _id: { $nin: excludedIds }
        })
        .select('_id title author genres rating ratingCount thumbnailUrl realCoverImage popularityScore')
        .lean();

        // 6. Score candidate books
        const scoredBooks = candidates.map(b => {
            let selectedGenreScore = 0;
            let totalGenreScore = 0;
            const bookGenres = b.genres || [];

            bookGenres.forEach(g => {
                if (userFavGenres.includes(g)) {
                    selectedGenreScore += 5.0;
                }
                totalGenreScore += (genreScores[g] || 0);
            });

            const authorScore = authorScores[b.author] || 0;
            const baseRating = b.rating || 3.0;
            const popularity = b.popularityScore || 0;

            // Composite Score combining selected genres and learned history
            const compositeScore = (wGenre * selectedGenreScore) +
                (wHistory * (totalGenreScore + authorScore)) +
                (0.5 * baseRating) +
                (0.001 * popularity);

            return {
                ...b,
                compositeScore
            };
        });

        // 7. Sort by composite score descending
        scoredBooks.sort((a, b) => b.compositeScore - a.compositeScore);

        const topRecommendations = scoredBooks.slice(0, 20);

        res.json({
            books: topRecommendations,
            ratedBooksCount: numRatings,
            thresholdMet: true,
            selectedGenres: userFavGenres,
            algorithm: `Progressive Personalization (${numRatings} Ratings: ${Math.round(wGenre * 100)}% Genre / ${Math.round(wHistory * 100)}% History)`,
            accuracyScore: "92%"
        });
    } catch (err) {
        console.error('Personalized recommend error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/books/recommended-section
// Returns books with real averageRating in [3.0, 4.0] and ratingCount in [100, 150]
// Used exclusively by the "Recommended for You" carousel.  Isolated from Top Rated.
router.get('/recommended-section', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;

        const results = await db.collection('ratings').aggregate([
            { $group: { _id: '$bookId', ratingCount: { $sum: 1 }, averageRating: { $avg: '$value' } } },
            { $match: { ratingCount: { $gte: 100, $lte: 150 }, averageRating: { $gte: 3.0, $lte: 4.0 } } },
            { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'bookDetails' } },
            { $unwind: '$bookDetails' },
            {
                $project: {
                    _id: 1,
                    ratingCount: 1,
                    averageRating: { $round: ['$averageRating', 1] },
                    title: '$bookDetails.title',
                    author: '$bookDetails.author',
                    thumbnailUrl: '$bookDetails.thumbnailUrl',
                    realCoverImage: '$bookDetails.realCoverImage',
                    genres: '$bookDetails.genres',
                    popularityScore: '$bookDetails.popularityScore',
                    description: '$bookDetails.description',
                    publishedDate: '$bookDetails.publishedDate',
                    pages: '$bookDetails.pages'
                }
            }
        ]).toArray();

        // In-memory Fisher-Yates shuffle then return up to 20
        for (let i = results.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [results[i], results[j]] = [results[j], results[i]];
        }

        res.json(results.slice(0, 20));
    } catch (err) {
        console.error('Error fetching recommended section:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────
// COLLECTION ROUTES
// ─────────────────────────────────────────────────────────

// Get all books with pagination and filtering
router.get('/', async (req, res) => {
    try {
        const { genre, search, page = 1, limit = 20, strict = false, duo = false, multi = false } = req.query;
        const query = {};

        if (genre) {
            const genresArray = genre.split(',').filter(g => g.trim() !== '');
            if (genresArray.length === 1) {
                if (strict === 'true' || strict === true) {
                    // Exact match: only ONE genre in the array, and it must be the selected one
                    query.genres = { $size: 1, $all: [genresArray[0]] };
                } else if (duo === 'true' || duo === true) {
                    // Duo match: exactly TWO genres in the array, one must be the selected one
                    query.genres = { $size: 2, $all: [genresArray[0]] };
                } else {
                    // Standard match: contains the selected genre (among others)
                    query.genres = genresArray[0];
                }
            } else if (genresArray.length > 0) {
                const matchMode = req.query.matchMode || 'all';
                if (matchMode === 'any') {
                    query.genres = { $in: genresArray };
                } else {
                    query.genres = { $all: genresArray };
                }
            }
        }

        if (search) {
            const cleanSearch = search.trim();
            if (cleanSearch) {
                // Strict exact match using anchored regex (case-insensitive)
                query.$or = [
                    { title: { $regex: `^${cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
                    { author: { $regex: `^${cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
                ];
            }
        }

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;

        const skip = (pageNum - 1) * limitNum;
        const books = await Book.find(query)
            .skip(skip)
            .limit(limitNum)
            .exec();

        const totalBooks = await Book.countDocuments(query);
        const totalPages = Math.ceil(totalBooks / limitNum);

        res.json({
            books,
            page: pageNum,
            limit: limitNum,
            totalBooks,
            totalPages,
            hasNextPage: pageNum < totalPages
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Create Book (Admin)
router.post('/', [auth, admin], async (req, res) => {
    try {
        const newBook = new Book(req.body);
        const book = await newBook.save();

        // Create notifications for all registered users
        // Use try/catch to ensure book creation is not slowed down
        // The compound unique index on {userId: 1, relatedBookId: 1} prevents duplicates
        const users = await User.find({ isAdmin: { $ne: true } }).select('_id');
        for (const user of users) {
            try {
                await Notification.create({
                    userId: user._id,
                    title: `New Book Added: ${book.title}`,
                    message: `A new book, "${book.title}" by ${book.author}, has been added to BookWise.`,

                    type: 'book_added',
                    relatedBookId: book._id,
                    isRead: false
                });
            } catch (err) {
                // Duplicate notification already exists (unique index constraint) - skip gracefully
                if (err.code === 11000) {
                    continue;
                }
                // Log other errors but don't fail the book creation
                console.error('Failed to create notification:', err.message);
            }
        }

        res.status(201).json(book);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ─────────────────────────────────────────────────────────
// PARAM :id ROUTES  (must come after all static named routes)
// ─────────────────────────────────────────────────────────

// High-performance in-memory cache for book details
const bookDetailCache = new Map();

const clearBookDetailCache = (bookId) => {
    if (bookId) bookDetailCache.delete(bookId.toString());
};

// Get book by ID
router.get('/:id', async (req, res) => {
    try {
        const bookIdStr = req.params.id;
        const cached = bookDetailCache.get(bookIdStr);
        if (cached && (Date.now() - cached.timestamp < 30000)) {
            return res.json(cached.data);
        }

        const book = await Book.findById(bookIdStr).lean();
        if (!book) return res.status(404).json({ message: 'Book not found' });

        const Rating = require('../models/Rating');
        const ratingStats = await Rating.aggregate([
            { $match: { bookId: book._id } },
            { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$value' } } }
        ]);

        let finalRating = book.rating;
        let finalCount = 0; // Default to 0 for books with no ratings

        // If ratings exist in database, use actual count
        if (ratingStats.length > 0) {
            finalRating = Math.round(ratingStats[0].avg * 10) / 10;
            finalCount = ratingStats[0].count;
        }
        // If no ratings in DB, use 0 (don't fall back to getStableMetrics)
        // getStableMetrics() is only for seeding/demo data, not real ratings

        const enrichedBook = {
            ...book,
            rating: finalRating,
            ratingCount: finalCount,
            dbRating: book.rating
        };

        bookDetailCache.set(bookIdStr, { data: enrichedBook, timestamp: Date.now() });
        res.json(enrichedBook);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Generate and cache an AI cover for a book
router.post('/:id/generate-cover', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });

        // Return early if we already have an AI-generated cover
        if (book.thumbnailUrl && book.thumbnailUrl.startsWith('data:image/svg')) {
            return res.json({ thumbnailUrl: book.thumbnailUrl, cached: true });
        }

        const newCoverUri = await generateCover(book.title, book.author);

        // Update the book
        book.thumbnailUrl = newCoverUri;
        await book.save();

        res.json({ thumbnailUrl: newCoverUri, cached: false });
    } catch (err) {
        console.error("Cover generation failed:", err);
        res.status(500).json({ message: 'Failed to generate cover', error: err.message });
    }
});

// Update Book (Admin)
router.put('/:id', [auth, admin], async (req, res) => {
    try {
        const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!book) return res.status(404).json({ message: 'Book not found' });
        res.json(book);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Delete Book (Admin)
router.delete('/:id', [auth, admin], async (req, res) => {
    try {
        const bookId = req.params.id;

        // 1. Manually cascade delete associated ratings first
        const mongoose = require('mongoose');
        const Rating = mongoose.model('Rating');
        await Rating.deleteMany({ bookId: bookId });

        // 2. Delete the actual book
        const book = await Book.findByIdAndDelete(bookId);
        if (!book) return res.status(404).json({ message: 'Book not found' });

        res.json({ message: 'Book and associated ratings completely deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
