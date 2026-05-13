'use strict';
const express         = require('express');
const router          = express.Router();
const { protect }     = require('../middleware/authMiddleware');
const stockController = require('../controllers/stockController');

// Public — no auth required
router.get('/',       stockController.getAllStock);
router.get('/alerts', stockController.getLowStockAlerts);

// Protected — all routes below require a valid JWT
router.use(protect);

router.get('/:id',          stockController.getStockById);
router.get('/:id/logs',     stockController.getStockLogs);
router.post('/',            stockController.createStock);
router.patch('/:id',        stockController.updateStock);
router.patch('/:id/restock', stockController.restockItem);
router.patch('/:id/deduct',  stockController.deductStock);

module.exports = router;
