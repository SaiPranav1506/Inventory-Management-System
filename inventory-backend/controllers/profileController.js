const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');

exports.getProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Get user info
    const user = await User.findById(userId).select('-passwordHash -__v').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Only allow users to view their own profile
    if (!req.userId || req.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Get user's item activity stats
    const totalItems = await Item.countDocuments({ owner: userId });
    // Only return items owned by this user
    const recentActivity = await Item.find({ owner: userId })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('name sku quantity updatedAt')
      .lean();

    // Calculate some basic stats
    const itemsByQuantity = await Item.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$quantity' },
          avgQuantity: { $avg: '$quantity' },
          maxQuantity: { $max: '$quantity' },
          minQuantity: { $min: '$quantity' }
        }
      }
    ]);

    const stats = itemsByQuantity[0] || {
      totalQuantity: 0,
      avgQuantity: 0,
      maxQuantity: 0,
      minQuantity: 0
    };

    res.json({
      user: {
        id: user._id,
        username: user.username,
        twoFactorEnabled: user.twoFactorEnabled || false,
        memberSince: user.createdAt,
        lastActive: user.updatedAt
      },
      stats: {
        totalItems,
        totalQuantity: stats.totalQuantity,
        averageQuantity: Math.round(stats.avgQuantity * 10) / 10,
        maxQuantity: stats.maxQuantity,
        minQuantity: stats.minQuantity
      },
      recentActivity
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
