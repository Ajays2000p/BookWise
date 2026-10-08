const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    relatedBookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Compound index to prevent duplicate notifications for the same user and book
notificationSchema.index({ userId: 1, relatedBookId: 1 }, { unique: true });

// Index for efficient querying of user notifications
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);