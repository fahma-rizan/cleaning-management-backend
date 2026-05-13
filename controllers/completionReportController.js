const completionReportService = require('../services/completionReportService');

/**
 * submit — job lead submits a completion report for a finished booking.
 *
 * The request body must include consumables and equipment arrays matching
 * what was allocated in the MaterialRequest.
 */
const submit = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const report = await completionReportService.submitReport(
      bookingId,
      req.user._id,
      req.body
    );
    res.status(201).json({ success: true, data: report, message: 'Completion report submitted.' });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * list — admin view of all completion reports, filterable by status.
 */
const list = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const data = await completionReportService.getReports({
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
 * getByBooking — fetch the report for a specific booking.
 */
const getByBooking = async (req, res) => {
  try {
    const report = await completionReportService.getReportByBooking(req.params.bookingId);
    res.status(200).json({ success: true, data: report });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * verify — admin approves or rejects a completion report.
 *
 * Approval triggers stock returns and loyalty point issuance.
 * Rejection unlocks the report for the job lead to revise.
 */
const verify = async (req, res) => {
  try {
    const { approved, rejectionReason } = req.body;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ success: false, message: '`approved` (boolean) is required' });
    }
    const report = await completionReportService.verifyReport(
      req.params.id,
      req.user._id,
      approved,
      rejectionReason
    );
    const action = approved ? 'approved' : 'rejected';
    res.status(200).json({ success: true, data: report, message: `Completion report ${action}.` });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * employeeHistory — admin can review an employee's entire report history.
 */
const employeeHistory = async (req, res) => {
  try {
    const reports = await completionReportService.getEmployeeReportHistory(req.params.userId);
    res.status(200).json({ success: true, data: reports });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { submit, list, getByBooking, verify, employeeHistory };
