const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// Get all notifications for the authenticated user
router.get('/', auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .select('title message type relatedBookId isRead createdAt')
            .sort({ createdAt: -1 });
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get unread notification count
router.get('/unread-count', auth, async (req, res) => {
    try {
        const unreadCount = await Notification.countDocuments({
            userId: req.user.id,
            isRead: false
        });
        res.json({ unreadCount });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Mark a notification as read
router.patch('/me/:id/mark-read', auth, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const updated = await Notification.updateOne(
            { _id: notificationId, userId: req.user.id, isRead: false },
            { $set: { isRead: true } }
        );
        if (updated.countModified > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ message: 'Notification not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Mark all notifications as read
router.patch('/me/mark-all-read', auth, async (req, res) => {
    try {
        const updated = await Notification.updateMany(
            { userId: req.user.id, isRead: false },
            { $set: { isRead: true } }
        );
        if (updated.countModified > 0) {
            res.json({ success: true, marked: updated.countModified });
        } else {
            res.status(404).json({ message: 'No unread notifications' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;