const express            = require('express');
const loyaltyController  = require('../controllers/loyaltyController');
const { protect }        = require('../middleware/authMiddleware');
const { requireRole }    = require('../middleware/roleMiddleware');
const AUTH               = require('../constants/auth');

const router = express.Router();
router.use(protect);

// Customer endpoints
router.get('/account',              loyaltyController.getAccount);
router.get('/history',              loyaltyController.getHistory);
router.post('/redeem',              loyaltyController.redeemPoints);
router.get('/tier-discount',        loyaltyController.getTierDiscount);
router.post('/tier-discount/apply', loyaltyController.applyTierDiscount);
router.post('/award', loyaltyController.awardPoints);

// Admin-only endpoints
router.post('/reverse',       requireRole(...AUTH.ADMIN_ROLES), loyaltyController.reversePoints);
router.post('/reset-yearly',  requireRole(...AUTH.ADMIN_ROLES), loyaltyController.resetYearly);

module.exports = router;
