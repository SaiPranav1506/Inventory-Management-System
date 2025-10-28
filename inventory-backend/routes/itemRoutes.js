const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const auth = require('../middleware/auth');

// Require auth for item operations so items are per-user
router.post('/', auth, itemController.addItem);
router.get('/', auth, itemController.getItems);
router.get('/:id', auth, itemController.getItemById);
router.put('/:id', auth, itemController.updateItem);
router.delete('/:id', auth, itemController.deleteItem);

module.exports = router;
