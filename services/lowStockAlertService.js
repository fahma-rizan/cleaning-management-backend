const InventoryItem  = require('../models/InventoryItem');
const LowStockAlert  = require('../models/LowStockAlert');
const INVENTORY      = require('../constants/inventory');

/**
 * checkAndCreateLowStockAlert — fires an alert only if one isn't already active.
 *
 * De-duplication is the core behaviour: we don't want a flood of alerts every
 * time stock is touched while already low. One active alert per item is enough.
 */
const checkAndCreateLowStockAlert = async (itemId) => {
  const item = await InventoryItem.findById(itemId).lean({ virtuals: true });
  if (!item) return null;

  // isLowStock virtual returns true when quantity <= lowStockThreshold
  if (!item.isLowStock) return null;

  // Existing active alert — stay silent to avoid notification spam
  const existing = await LowStockAlert.findOne({
    itemId,
    status: INVENTORY.ALERT_STATUSES.ACTIVE,
  });
  if (existing) return null;

  const alert = await LowStockAlert.create({
    itemId,
    triggerQuantity:  item.quantity,
    triggerThreshold: item.lowStockThreshold,
  });

  return alert;
};

/**
 * resolveAlert — called automatically on restock so the dashboard clears itself.
 *
 * Passing newQuantity allows the dashboard to show "resolved at X units"
 * without a separate item fetch.
 */
const resolveAlert = async (itemId, userId, newQuantity) => {
  const alert = await LowStockAlert.findOne({
    itemId,
    status: INVENTORY.ALERT_STATUSES.ACTIVE,
  });

  if (!alert) return null;

  alert.status           = INVENTORY.ALERT_STATUSES.RESOLVED;
  alert.resolvedAt       = new Date();
  alert.resolvedBy       = userId;
  alert.resolvedQuantity = newQuantity;
  await alert.save();

  return alert;
};

/**
 * getActiveAlerts — used on admin dashboard to show current shortfalls.
 */
const getActiveAlerts = async () => {
  return LowStockAlert.find({ status: INVENTORY.ALERT_STATUSES.ACTIVE })
    .populate('itemId', 'name sku quantity lowStockThreshold unit type')
    .sort({ createdAt: -1 });
};

/**
 * getAlertHistory — paginated history of all resolved alerts for trend analysis.
 */
const getAlertHistory = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const [alerts, total] = await Promise.all([
    LowStockAlert.find()
      .populate('itemId',     'name sku unit')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    LowStockAlert.countDocuments(),
  ]);

  return { alerts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

module.exports = {
  checkAndCreateLowStockAlert,
  resolveAlert,
  getActiveAlerts,
  getAlertHistory,
};
