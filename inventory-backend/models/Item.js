const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  sku: { type: String, required: true, unique: true, index: true },
  quantity: { type: Number, default: 0, index: true },
  description: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true });

// Add compound index for common queries
itemSchema.index({ name: 1, sku: 1 });

module.exports = mongoose.model('Item', itemSchema);
