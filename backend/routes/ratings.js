const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Rating = require('../models/Rating');
const Book = require('../models/Book');

const { clearRankingsCache } = require('./rankings');
const { clearBookDetailCache } = require('./books');

// Submit or update a rating
router.post('/', auth, async (req, res) => {
    try {
        const { bookId, value } = req.body;
        const userId = req.user._id;

        if (!value || value < 1 || value > 5) {
            return res.status(400).json({ message: 'Valid rating value (1-5) is required' });
        }

        let rating = await Rating.findOne({ userId, bookId });

        if (rating) {
            rating.value = value;
            await rating.save();
        } else {
            rating = new Rating({ userId, bookId, value });
            await rating.save();
        }

        // Update Book stats in MongoDB
        const allRatings = await Rating.find({ bookId });
        const count = allRatings.length;
        const sum = allRatings.reduce((acc, curr) => acc + curr.value, 0);
        const avg = count > 0 ? sum / count : 0;
        const newRating = parseFloat(avg.toFixed(1));

        await Book.findByIdAndUpdate(bookId, {
            rating: newRating,
            ratingCount: count
        });

        clearRankingsCache();
        if (typeof clearBookDetailCache === 'function') {
            clearBookDetailCache(bookId);
        }

        const resData = rating.toObject ? rating.toObject() : { ...rating };
        resData.ratingCount = count;
        resData.averageRating = newRating;

        res.status(200).json(resData);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get user's rating for a specific book
router.get('/:bookId', auth, async (req, res) => {
    try {
        const rating = await Rating.findOne({ userId: req.user._id, bookId: req.params.bookId });
        res.json(rating || { value: 0 });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
