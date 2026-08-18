const consumptionRateService = require('../services/consumptionRateService');

/**
 * list — returns all consumption rates, optionally filtered by serviceType.
 */
const list = async (req, res) => {
  try {
    const { serviceType } = req.query;
    const rates = await consumptionRateService.getRates({ serviceType });
    res.status(200).json({ success: true, data: rates });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * getByServiceType — all active rates for a single service type.
 */
const getByServiceType = async (req, res) => {
  try {
    const rates = await consumptionRateService.getRatesByService(req.params.serviceType);
    res.status(200).json({ success: true, data: rates });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * upsert — create or update a consumption rate.
 *
 * POST body: { serviceType, itemId, qtyPerRoom, notes }
 */
const upsert = async (req, res) => {
  try {
    const rate = await consumptionRateService.upsertRate(req.body, req.user._id);
    res.status(200).json({ success: true, data: rate });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * deleteRate — remove a consumption rate entirely.
 */
const deleteRate = async (req, res) => {
  try {
    await consumptionRateService.deleteRate(req.params.id);
    res.status(200).json({ success: true, message: 'Consumption rate deleted.' });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

module.exports = { list, getByServiceType, upsert, deleteRate };
