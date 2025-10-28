const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true, lowercase: true },
  passwordHash: { type: String, required: true },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorCodeHash: { type: String },
  twoFactorExpires: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
