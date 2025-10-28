const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mailer = require('../lib/mailer');

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'username, email and password required' });

    // Check for existing username or email
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(409).json({ message: 'username or email already exists' });

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await User.create({ username, email, passwordHash });
    res.status(201).json({ id: user._id, username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    // Accept a single identifier field which can be username or email for compatibility
    const identifier = req.body.identifier || req.body.username || req.body.email;
    const { password } = req.body;
    if (!identifier || !password) return res.status(400).json({ message: 'username/email and password required' });

    // Try to find by username first, then by email
    let user = await User.findOne({ username: identifier });
    if (!user && identifier.includes && identifier.includes('@')) {
      user = await User.findOne({ email: identifier.toLowerCase() });
    }
    if (!user) return res.status(401).json({ message: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'invalid credentials' });

    // If user has two-factor enabled, generate a one-time code and return a temp token
    if (user.twoFactorEnabled) {
      // generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const saltRounds = 10;
      const codeHash = await bcrypt.hash(code, saltRounds);
      // set code expiry (5 minutes)
      user.twoFactorCodeHash = codeHash;
      user.twoFactorExpires = new Date(Date.now() + 5 * 60 * 1000);
      await user.save();

      // create temporary token that allows 2FA verification (short-lived)
      const tempToken = jwt.sign({ sub: user._id, twoFactor: true }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '10m' });

      // Attempt to send the code by email. If mailer isn't configured, log to console (dev fallback).
      const from = process.env.EMAIL_FROM || 'no-reply@inventory.local';
      const mailOptions = {
        from,
        to: user.email,
        subject: 'Your one-time verification code',
        text: `Your verification code is: ${code}. It expires in 5 minutes.`,
        html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 5 minutes.</p>`
      };

      let previewUrl = null;
      try {
        const result = await mailer.sendMail({
          from: process.env.EMAIL_FROM || 'no-reply@inventory.local',
          to: user.email,
          subject: 'Your one-time verification code',
          text: `Your verification code is: ${code}. It expires in 5 minutes.`,
          html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 5 minutes.</p>`
        });
        console.log(`2FA email send result for ${user.email}:`, result.info && result.info.messageId);
        previewUrl = result.previewUrl || null;
      } catch (err) {
        console.error('Failed to send 2FA email, falling back to console log. Error:', err);
        console.log(`2FA code for user ${user.username} (${user.email}): ${code}`);
      }

      const responsePayload = { twoFactorRequired: true, tempToken };
      if (previewUrl) responsePayload.previewUrl = previewUrl;
      if (process.env.DEV_SHOW_2FA_CODE === 'true') responsePayload.code = code;
      return res.json(responsePayload);
    }

    // create a JWT (optional, expires in 1h)
    const token = jwt.sign({ sub: user._id, username: user.username }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '1h' });

    res.json({ token, id: user._id, username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Verify 2FA code using the temporary token + provided code
exports.verifyTwoFactor = async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) return res.status(400).json({ message: 'tempToken and code required' });

    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET || 'devsecret');
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired temp token' });
    }

    if (!payload || !payload.sub) return res.status(400).json({ message: 'Invalid token payload' });

    const user = await User.findById(payload.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.twoFactorCodeHash || !user.twoFactorExpires) return res.status(400).json({ message: 'No 2FA code pending' });
    if (user.twoFactorExpires < new Date()) return res.status(400).json({ message: '2FA code expired' });

    const ok = await bcrypt.compare(code, user.twoFactorCodeHash);
    if (!ok) return res.status(401).json({ message: 'Invalid 2FA code' });

    // Clear the stored code
    user.twoFactorCodeHash = undefined;
    user.twoFactorExpires = undefined;
    await user.save();

    // Issue final JWT
    const token = jwt.sign({ sub: user._id, username: user.username }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '1h' });
    res.json({ token, id: user._id, username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Resend 2FA code for a tempToken (allows user to request a new code while keeping the same tempToken)
exports.resendTwoFactor = async (req, res) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) return res.status(400).json({ message: 'tempToken required' });

    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET || 'devsecret');
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired temp token' });
    }

    if (!payload || !payload.sub) return res.status(400).json({ message: 'Invalid token payload' });

    const user = await User.findById(payload.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.twoFactorEnabled) return res.status(400).json({ message: 'Two-factor not enabled for this user' });

    // generate new 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const saltRounds = 10;
    user.twoFactorCodeHash = await bcrypt.hash(code, saltRounds);
    user.twoFactorExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    // send email
    let previewUrl = null;
    try {
      const result = await mailer.sendMail({
        from: process.env.EMAIL_FROM || 'no-reply@inventory.local',
        to: user.email,
        subject: 'Your one-time verification code (resend)',
        text: `Your verification code is: ${code}. It expires in 5 minutes.`,
        html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 5 minutes.</p>`
      });
      previewUrl = result.previewUrl || null;
      console.log(`Resent 2FA email to ${user.email}. messageId=${result.info && result.info.messageId}`);
    } catch (err) {
      console.error('Failed to resend 2FA email, falling back to console log. Error:', err);
      console.log(`2FA code (resend) for user ${user.username} (${user.email}): ${code}`);
    }

    const payloadOut = { message: '2FA code resent' };
    if (previewUrl) payloadOut.previewUrl = previewUrl;
    if (process.env.DEV_SHOW_2FA_CODE === 'true') payloadOut.code = code;
    return res.json(payloadOut);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Enable two-factor authentication for the authenticated user
exports.enableTwoFactor = async (req, res) => {
  try {
    const userId = req.userId || (req.body && req.body.userId);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.twoFactorEnabled = true;
    await user.save();
    res.json({ message: 'Two-factor authentication enabled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Disable two-factor authentication for the authenticated user
exports.disableTwoFactor = async (req, res) => {
  try {
    const userId = req.userId || (req.body && req.body.userId);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.twoFactorEnabled = false;
    // clear any pending codes
    user.twoFactorCodeHash = undefined;
    user.twoFactorExpires = undefined;
    await user.save();
    res.json({ message: 'Two-factor authentication disabled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
