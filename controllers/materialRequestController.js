const materialRequestService = require('../services/materialRequestService');

/**
 * create — internal endpoint that triggers the material-needs calculation.
 *
 * Normally called automatically from the booking creation flow, but exposed
 * here so admin can manually trigger it (e.g. after fixing a booking's roomCount).
 */
const create = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const request = await materialRequestService.calculateMaterialNeeds(bookingId);
    res.status(201).json({ success: true, data: request });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * list — paginated list of material requests for the admin queue.
 */
const list = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const data = await materialRequestService.getMaterialRequests({
      status,
      page:  parseInt(page)  || 1,
      limit: parseInt(limit) || 20,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * getByBooking — fetch the request tied to a specific booking.
 */
const getByBooking = async (req, res) => {
  try {
    const request = await materialRequestService.getMaterialRequestByBooking(req.params.bookingId);
    res.status(200).json({ success: true, data: request });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * approve — admin approves a material request and triggers stock deduction.
 */
const approve = async (req, res) => {
  try {
    const request = await materialRequestService.approveMaterialRequest(
      req.params.id,
      req.user._id
    );
    res.status(200).json({ success: true, data: request, message: 'Material request approved. Stock deducted.' });
  } catch (err) {
    // 400 for business logic errors (insufficient stock), 404 for not found
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * reject — admin rejects a material request with a mandatory reason.
 */
const reject = async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await materialRequestService.rejectMaterialRequest(
      req.params.id,
      req.user._id,
      reason
    );
    res.status(200).json({ success: true, data: request, message: 'Material request rejected.' });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

module.exports = { create, list, getByBooking, approve, reject };
