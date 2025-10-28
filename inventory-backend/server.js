const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();
const mailer = require('./lib/mailer');

const app = express();

// Middleware
app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:61806', 'http://localhost:4201'],
  credentials: true
}));

// Routes
const itemRoutes = require('./routes/itemRoutes');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
app.use('/api/items', itemRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

// MongoDB connection with optimized settings
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('Mongo Error:', err));

const port = process.env.PORT || 5000;

(async () => {
  try {
    await mailer.initMailer();
  } catch (err) {
    console.error('Mailer init failed:', err);
  }

  app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
})();
