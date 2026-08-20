const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refundController');
const auth = require('../middleware/auth');

// @route   GET /api/refunds
// @desc    Get all refund requests
// @access  Private (for admin)
router.get('/', auth, refundController.getAllRefunds);

// @route   POST /api/refunds/request
// @desc    A customer requests a refund for an invoice
// @access  Private
router.post('/request', auth, refundController.requestRefund);

// @route   POST /api/refunds/approve/:refundId
// @desc    Admin approves a refund request
// @access  Private (for admin)
router.post('/approve/:refundId', auth, refundController.approveRefund);

// @route   POST /api/refunds/reject/:refundId
// @desc    Admin rejects a refund request
// @access  Private (for admin)
router.post('/reject/:refundId', auth, refundController.rejectRefund);

module.exports = router;