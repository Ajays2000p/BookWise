const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB:', mongoose.connection.name);
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });

// API health check
app.get('/', (req, res) => {
    res.send('BookWise API is running.');
});

// Import routes
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const ratingRoutes = require('./routes/ratings');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const rankingRoutes = require('./routes/rankings');
const recommendedRoutes = require('./routes/recommended');
const notificationRoutes = require('./routes/notifications');

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/recommended', recommendedRoutes);

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('Server is running on port ' + PORT + ' (0.0.0.0)');
});
