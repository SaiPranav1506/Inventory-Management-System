const Item = require('../models/Item');

// CREATE
exports.addItem = async (req, res) => {
  try {
    // Attach owner from authenticated request if available
    const body = Object.assign({}, req.body);
    if (req.userId) body.owner = req.userId;
    const item = await Item.create(body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// READ ALL - optimized with lean() and select
exports.getItems = async (req, res) => {
  try {
    const query = {};
    // If user is authenticated, only return their items
    if (req.userId) query.owner = req.userId;

    const items = await Item.find(query)
      .select('-__v')
      .lean()
      .sort({ createdAt: -1 })
      .limit(1000);
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// READ ONE - optimized with lean()
exports.getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).select('-__v').lean();
    if (!item) return res.status(404).json({ message: 'Item not found' });
    // If authenticated, ensure owner matches
    if (req.userId && item.owner && item.owner.toString() !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE - optimized with lean()
exports.updateItem = async (req, res) => {
  try {
    const existing = await Item.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Item not found' });
    if (req.userId && existing.owner && existing.owner.toString() !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Prevent changing owner via update
    if (req.body.owner) delete req.body.owner;

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-__v').lean();
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE - optimized
exports.deleteItem = async (req, res) => {
  try {
    const existing = await Item.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Item not found' });
    if (req.userId && existing.owner && existing.owner.toString() !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await Item.findByIdAndDelete(req.params.id).lean();
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
