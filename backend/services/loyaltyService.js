const LOYALTY            = require('../constants/loyalty.constants');
const LoyaltyAccount     = require('../models/LoyaltyAccount');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');

/* ── helpers ──────────────────────────────────────────────── */

const getOrCreateAccount = async (customerId) => {
  let account = await LoyaltyAccount.findOne({ customerId });
  if (!account) account = await LoyaltyAccount.create({ customerId });
  return account;
};

const tierFromLifetime = (pts) => {
  if (pts >= LOYALTY.TIER_THRESHOLDS.PLATINUM.min) return 'platinum';
  if (pts >= LOYALTY.TIER_THRESHOLDS.GOLD.min)     return 'gold';
  if (pts >= LOYALTY.TIER_THRESHOLDS.SILVER.min)   return 'silver';
  return 'bronze';
};

const upgradeTierIfEligible = async (account) => {
  const earned = tierFromLifetime(account.lifetimePoints);
  if (account.currentTier !== earned) {
    const prevTier          = account.currentTier;
    account.currentTier     = earned;
    await account.save();

    await LoyaltyTransaction.create({
      userId:              account.customerId,
      type:                LOYALTY.TRANSACTION_TYPES.BONUS,
      points:              0,
      balanceAfter:        account.currentBalance,
      lifetimePointsAfter: account.lifetimePoints,
      reason:              `Tier upgraded from ${prevTier} to ${earned} — lifetime points reached ${LOYALTY.TIER_THRESHOLDS[earned.toUpperCase()].min}`,
    });
  }
  return account;
};

/* ── public functions ─────────────────────────────────────── */

/**
 * Award points when a booking payment is confirmed.
 * Earning rate is determined by the customer's current tier.
 * Pass paidByPoints = true when the booking was fully covered by a points redemption
 * so no additional points are earned on that transaction.
 */
const awardPoints = async (customerId, bookingId, amountPaidInRs, paymentStage = 'full', paidByPoints = false) => {
  if (paidByPoints) return await getOrCreateAccount(customerId);

  const account     = await getOrCreateAccount(customerId);
  const earningRate = LOYALTY.TIER_EARNING_RATES[account.currentTier.toUpperCase()];
  const points      = Math.floor((amountPaidInRs / 100) * earningRate);

  if (points <= 0) return account;

  account.currentBalance += points;
  account.lifetimePoints += points;
  await account.save();

  await LoyaltyTransaction.create({
    userId: customerId,
    bookingId,
    type:                LOYALTY.TRANSACTION_TYPES.EARNED,
    points,
    balanceAfter:        account.currentBalance,
    lifetimePointsAfter: account.lifetimePoints,
    reason:              `Earned for booking payment (${paymentStage})`,
    paymentStage,
  });

  await upgradeTierIfEligible(account);
  return account;
};

/**
 * Reverse earned points on booking cancellation.
 * Company-initiated cancellations are goodwill — customer keeps points.
 */
const reversePoints = async (customerId, bookingId, cancelledBy) => {
  if (cancelledBy === 'company') return null;

  const earnedTx = await LoyaltyTransaction.findOne({
    userId: customerId,
    bookingId,
    type: LOYALTY.TRANSACTION_TYPES.EARNED,
  });
  if (!earnedTx) return null;

  const account   = await getOrCreateAccount(customerId);
  const toReverse = Math.min(earnedTx.points, account.currentBalance);
  if (toReverse <= 0) return null;

  account.currentBalance = Math.max(0, account.currentBalance - toReverse);
  await account.save();

  await LoyaltyTransaction.create({
    userId: customerId,
    bookingId,
    type:                LOYALTY.TRANSACTION_TYPES.REVERSED,
    points:              -toReverse,
    balanceAfter:        account.currentBalance,
    lifetimePointsAfter: account.lifetimePoints,
    reason:              'Booking cancelled by customer',
    cancelledBy,
  });

  return account;
};

/**
 * Redeem points from currentBalance (never touches lifetimePoints).
 * Minimum 100 pts required in currentBalance.
 * @param {string} bookingId - The booking this redemption is applied to.
 * @param {number} bookingAmountInRs - Total booking amount before discount; used to compute finalAmountAfterRedemption.
 */
const redeemPoints = async (customerId, bookingId, points, bookingAmountInRs) => {
  if (!points || points <= 0) throw new Error('Points must be greater than zero');

  const account = await getOrCreateAccount(customerId);

  if (account.currentBalance < LOYALTY.REDEMPTION.MIN_REDEEM) {
    throw new Error(`You need at least ${LOYALTY.REDEMPTION.MIN_REDEEM} points to redeem`);
  }
  if (points > account.currentBalance) {
    throw new Error('Insufficient points balance');
  }

  const rupeeValue = points * LOYALTY.REDEMPTION.POINTS_TO_RUPEES;

  account.currentBalance -= points;
  await account.save();

  await LoyaltyTransaction.create({
    userId: customerId,
    bookingId,
    type:                LOYALTY.TRANSACTION_TYPES.REDEEMED,
    points:              -points,
    balanceAfter:        account.currentBalance,
    lifetimePointsAfter: account.lifetimePoints,
    reason:              `Redeemed ${points} pts for Rs. ${rupeeValue} discount`,
  });

  return {
    account,
    rupeeValue,
    finalAmountAfterRedemption: bookingAmountInRs - rupeeValue,
  };
};

/**
 * Mark the current tier's one-time discount as used and return discount details.
 * @param {number} bookingAmountInRs - Booking total before discount; used to compute discountAmount and amountAfterDiscount.
 */
const applyTierDiscount = async (customerId, bookingAmountInRs) => {
  const account = await getOrCreateAccount(customerId);
  const tier    = account.currentTier;

  if (tier === 'bronze') {
    throw new Error('No tier discount available for Bronze tier');
  }
  if (account.tierDiscountsUsed[tier]) {
    throw new Error(`${tier.charAt(0).toUpperCase() + tier.slice(1)} tier discount has already been used`);
  }

  const discountPercent = LOYALTY.TIER_ONE_TIME_DISCOUNTS[tier.toUpperCase()];
  const discountRate    = discountPercent / 100;
  const discountAmount  = bookingAmountInRs * discountRate;

  account.tierDiscountsUsed[tier] = true;
  account.markModified('tierDiscountsUsed');
  await account.save();

  return {
    discountPercent,
    tier,
    discountAmount,
    amountAfterDiscount: bookingAmountInRs - discountAmount,
  };
};

/**
 * Cron handler — resets currentBalance to 0 on December 31.
 * lifetimePoints and tier are never modified.
 */
const resetYearlyBalance = async () => {
  const accounts = await LoyaltyAccount.find({ currentBalance: { $gt: 0 } });
  const now      = new Date();

  for (const account of accounts) {
    const expired              = account.currentBalance;
    account.currentBalance     = 0;
    account.balanceLastResetAt = now;
    await account.save();

    await LoyaltyTransaction.create({
      userId:              account.customerId,
      type:                LOYALTY.TRANSACTION_TYPES.EXPIRED,
      points:              -expired,
      balanceAfter:        0,
      lifetimePointsAfter: account.lifetimePoints,
      reason:              'Annual balance reset (December 31)',
    });
  }

  return { resetCount: accounts.length };
};

/**
 * Paginated transaction history.
 * @param {string} [filters.bookingId] - Filter transactions to a specific booking.
 */
const getPointsHistory = async (customerId, { page = 1, limit = 20, type, startDate, endDate, bookingId } = {}) => {
  const filter = { userId: customerId };
  if (type)      filter.type      = type;
  if (bookingId) filter.bookingId = bookingId;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate)   filter.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    LoyaltyTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    LoyaltyTransaction.countDocuments(filter),
  ]);

  return {
    transactions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

/**
 * Full account summary for the dashboard.
 */
const getLoyaltySummary = async (customerId) => {
  const account           = await getOrCreateAccount(customerId);
  const tier              = account.currentTier;
  const discountAvailable = tier !== 'bronze' && !account.tierDiscountsUsed[tier];
  const discountPercent   = discountAvailable
    ? LOYALTY.TIER_ONE_TIME_DISCOUNTS[tier.toUpperCase()]
    : 0;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [monthResult] = await LoyaltyTransaction.aggregate([
    {
      $match: {
        userId:    account.customerId,
        type:      LOYALTY.TRANSACTION_TYPES.EARNED,
        createdAt: { $gte: startOfMonth },
      },
    },
    { $group: { _id: null, total: { $sum: '$points' } } },
  ]);

  return {
    currentBalance:    account.currentBalance,
    lifetimePoints:    account.lifetimePoints,
    currentTier:       tier,
    tierDiscountsUsed: account.tierDiscountsUsed,
    discountAvailable,
    discountPercent,
    earnedThisMonth:   monthResult?.total || 0,
    points:            account.currentBalance,
  };
};

module.exports = {
  getOrCreateAccount,
  awardPoints,
  reversePoints,
  redeemPoints,
  applyTierDiscount,
  resetYearlyBalance,
  getPointsHistory,
  getLoyaltySummary,
};
