'use strict';

// Lazy require matches the pattern used throughout this codebase to break
// potential circular dependency chains between service modules.
const getLowStockAlertService = () => require('./lowStockAlertService');

/**
 * Creates a low-stock alert for the given InventoryItem if one is not already active.
 * Delegates to lowStockAlertService so all alerts land in the LowStockAlert collection.
 */
const triggerLowStockAlert = async (item) => {
  return getLowStockAlertService().checkAndCreateLowStockAlert(item._id);
};

/**
 * Resolves the active low-stock alert for the given itemId.
 */
const resolveLowStockAlert = async (itemId, userId, newQuantity) => {
  return getLowStockAlertService().resolveAlert(itemId, userId, newQuantity);
};

module.exports = { triggerLowStockAlert, resolveLowStockAlert };
