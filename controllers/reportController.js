const reportService = require('../services/reportService');

/**
 * monthly — stock movement breakdown for a given year+month.
 *
 * Query params: year (default current year), month (1-12, default current month)
 */
const monthly = async (req, res) => {
  try {
    const now   = new Date();
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'month must be 1–12' });
    }

    const data = await reportService.getMonthlyReport(year, month);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * anomalies — summary of flagged completion reports for a given month.
 *
 * Query params: year, month (same defaults as monthly)
 */
const anomalies = async (req, res) => {
  try {
    const now   = new Date();
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'month must be 1–12' });
    }

    const data = await reportService.getAnomalySummary(year, month);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { monthly, anomalies };
