const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    genres: [{ type: String }],
    description: { type: String },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    popularityScore: { type: Number, default: 0, set: v => Math.floor(v || 0) },
    thumbnailUrl: { type: String },
    realCoverImage: { type: String, default: null },
    coverMigrationAttempted: { type: Boolean, default: false },
    URL: { type: String },
    publishedDate: { type: String, default: null },
    dateMigrationAttempted: { type: Boolean, default: false },
    pages: { type: Number },
    // Optional external retailer product-page URL supplied by admins.
    // Empty/whitespace-only values are normalized to null; only http(s) URLs are allowed.
    purchaseUrl: {
        type: String,
        default: null,
        set: v => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v),
        validate: {
            validator: function (v) {
                if (v === null || v === undefined) return true;
                try {
                    const parsed = new URL(v);
                    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
                } catch (e) {
                    return false;
                }
            },
            message: 'purchaseUrl must be a valid http(s) URL'
        }
    },
}, { timestamps: true });

bookSchema.index({ title: 1, author: 1 }, { unique: true });
bookSchema.index({ title: 'text', author: 'text', genres: 'text' });
bookSchema.index({ genres: 1 });
bookSchema.index({ ratingCount: 1 });
bookSchema.index({ createdAt: -1 });

// Middleware to cascade delete ratings when a book is deleted one-by-one
bookSchema.pre('findOneAndDelete', async function () {
    const doc = await this.model.findOne(this.getQuery());
    if (doc) {
        const Rating = mongoose.model('Rating');
        await Rating.deleteMany({ bookId: doc._id });
    }
});

// Middleware to cascade delete ratings when multiple books are deleted
bookSchema.pre('deleteMany', async function () {
    const docs = await this.model.find(this.getQuery());
    if (docs && docs.length > 0) {
        const bookIds = docs.map(d => d._id);
        const Rating = mongoose.model('Rating');
        await Rating.deleteMany({ bookId: { $in: bookIds } });
    }
});

module.exports = mongoose.model('Book', bookSchema);
