const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/verify-2fa', authController.verifyTwoFactor);

// Protected endpoints to enable/disable 2FA for the currently authenticated user
router.post('/enable-2fa', authMiddleware, authController.enableTwoFactor);
router.post('/disable-2fa', authMiddleware, authController.disableTwoFactor);
// Allow resending a 2FA code using the temp token returned at login
router.post('/resend-2fa', authController.resendTwoFactor);

module.exports = router;
