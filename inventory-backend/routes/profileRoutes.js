const express = require('express');

const router = express.Router();
const profileController = require('../controllers/profileController');
const auth = require('../middleware/auth');

// Require authentication and only allow owner to fetch their profile
router.get('/:userId', auth, profileController.getProfile);

module.exports = router;
