const loyaltyService = require('../services/loyaltyService');

const getAccount = async (req, res) => {
  try {
    const data = await loyaltyService.getLoyaltySummary(req.user._id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const { page, limit, type, startDate, endDate, bookingId } = req.query;
    const data = await loyaltyService.getPointsHistory(req.user._id, {
      page:      parseInt(page)  || 1,
      limit:     parseInt(limit) || 20,
      type,
      startDate,
      endDate,
      bookingId,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const redeemPoints = async (req, res) => {
  try {
    const { bookingId, points, bookingAmountInRs } = req.body;
    if (!points || points <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid points amount' });
    }
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required' });
    }
    if (!bookingAmountInRs || bookingAmountInRs <= 0) {
      return res.status(400).json({ success: false, message: 'bookingAmountInRs is required' });
    }
    const result = await loyaltyService.redeemPoints(req.user._id, bookingId, points, bookingAmountInRs);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getTierDiscount = async (req, res) => {
  try {
    const account = await loyaltyService.getOrCreateAccount(req.user._id);
    const tier    = account.currentTier;

    if (tier === 'bronze' || account.tierDiscountsUsed[tier]) {
      return res.status(200).json({
        success: true,
        data: { available: false, discountPercent: 0, tier },
      });
    }

    const LOYALTY         = require('../constants/loyalty.constants');
    const discountPercent = LOYALTY.TIER_ONE_TIME_DISCOUNTS[tier.toUpperCase()];

    res.status(200).json({
      success: true,
      data: { available: true, discountPercent, tier },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const applyTierDiscount = async (req, res) => {
  try {
    const { bookingAmountInRs } = req.body;
    if (!bookingAmountInRs || bookingAmountInRs <= 0) {
      return res.status(400).json({ success: false, message: 'bookingAmountInRs is required' });
    }
    const result = await loyaltyService.applyTierDiscount(req.user._id, bookingAmountInRs);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * awardPoints — called internally by the system after a payment is confirmed.
 * Never called directly by a customer — admin/system role required.
 */
const awardPoints = async (req, res) => {
  try {
    const { customerId, bookingId, amountPaid, paymentStage } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'customerId is required' });
    }
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required' });
    }
    if (!amountPaid || amountPaid <= 0) {
      return res.status(400).json({ success: false, message: 'amountPaid must be a positive number' });
    }
    if (!paymentStage) {
      return res.status(400).json({ success: false, message: 'paymentStage is required (advance/remaining/full)' });
    }

    const result = await loyaltyService.awardPoints(customerId, bookingId, amountPaid, paymentStage);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const reversePoints = async (req, res) => {
  try {
    const { customerId, bookingId, cancelledBy } = req.body;
    if (!customerId || !bookingId || !cancelledBy) {
      return res.status(400).json({ success: false, message: 'customerId, bookingId, and cancelledBy are required' });
    }
    const result = await loyaltyService.reversePoints(customerId, bookingId, cancelledBy);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const resetYearly = async (req, res) => {
  try {
    const result = await loyaltyService.resetYearlyBalance();
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAccount,
  getHistory,
  redeemPoints,
  getTierDiscount,
  applyTierDiscount,
  awardPoints,
  reversePoints,
  resetYearly,
};