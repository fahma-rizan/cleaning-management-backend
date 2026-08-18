const lowStockAlertService = require('../services/lowStockAlertService');

/**
 * getActive — returns all currently active low-stock alerts.
 *
 * Displayed on the admin dashboard so procurement action can be taken quickly.
 */
const getActive = async (req, res) => {
  try {
    const alerts = await lowStockAlertService.getActiveAlerts();
    res.status(200).json({ success: true, data: alerts });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * getHistory — paginated history of all alerts including resolved ones.
 */
const getHistory = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const data = await lowStockAlertService.getAlertHistory({
      page:  parseInt(page)  || 1,
      limit: parseInt(limit) || 20,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * resolve — admin manually marks an alert resolved (e.g. after a restock
 * that happened outside the normal adjustStock flow).
 */
const resolve = async (req, res) => {
  try {
    // newQuantity is optional — pass it when known so the resolved snapshot is accurate
    const { itemId, newQuantity } = req.body;
    if (!itemId) return res.status(400).json({ success: false, message: 'itemId is required' });

    const alert = await lowStockAlertService.resolveAlert(itemId, req.user._id, newQuantity);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'No active alert found for this item' });
    }
    res.status(200).json({ success: true, data: alert, message: 'Alert resolved.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { getActive, getHistory, resolve };
