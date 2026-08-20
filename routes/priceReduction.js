const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const ctrl     = require('../controllers/priceReductionController');

// @route   POST /api/price-reductions/request
// @desc    Customer submits a price reduction request
// @access  Private
router.post('/request', auth, ctrl.requestPriceReduction);

// @route   GET /api/price-reductions
// @desc    Get all pending price reduction requests (admin)
// @access  Private
router.get('/', auth, ctrl.getAllReductions);

// @route   POST /api/price-reductions/approve/:id
// @desc    Admin approves a price reduction
// @access  Private
router.post('/approve/:id', auth, ctrl.approveReduction);

// @route   POST /api/price-reductions/reject/:id
// @desc    Admin rejects a price reduction
// @access  Private
router.post('/reject/:id', auth, ctrl.rejectReduction);

module.exports = router;