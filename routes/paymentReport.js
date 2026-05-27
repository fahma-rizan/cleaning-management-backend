const express = require('express');
const router  = express.Router();
const Invoice = require('../models/Invoice');

// @route  GET /api/payment-report
// @desc   Get payment report with filters (admin use)
// @query  userId, serviceType, paymentMethod, status, fromDate, toDate, customerName, customerPhone
router.get('/', async (req, res) => {
  try {
    const { userId, serviceType, status, fromDate, toDate, customerName, customerPhone } = req.query;

    const query = {};

    // Filter by user
    if (userId) query['customer.userId'] = userId;

    // Filter by customer name (case-insensitive partial match)
    if (customerName) query['customer.name'] = { $regex: customerName, $options: 'i' };

    // Filter by customer phone
    if (customerPhone) query['customer.phone'] = { $regex: customerPhone };

    // Filter by invoice status
    if (status) query.status = status.toUpperCase();

    // Filter by date range
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate)   query.createdAt.$lte = new Date(toDate + 'T23:59:59');
    }

    const invoices = await Invoice.find(query).sort({ createdAt: -1 });

    // Build summary stats
    const totalRevenue   = invoices.reduce((s, inv) => s + inv.totalAmount, 0);
    const totalCollected = invoices.reduce((s, inv) => s + inv.paidAmount, 0);
    const totalPending   = invoices.reduce((s, inv) => s + inv.balanceAmount, 0);

    res.json({
      summary: { totalRevenue, totalCollected, totalPending, count: invoices.length },
      invoices,
    });
  } catch (error) {
    console.error('Error generating payment report:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route  GET /api/payment-report/export
// @desc   Export payment report as CSV data
router.get('/export', async (req, res) => {
  try {
    const { fromDate, toDate, status, customerName } = req.query;

    const query = {};
    if (status)       query.status = status.toUpperCase();
    if (customerName) query['customer.name'] = { $regex: customerName, $options: 'i' };
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate)   query.createdAt.$lte = new Date(toDate + 'T23:59:59');
    }

    const invoices = await Invoice.find(query).sort({ createdAt: -1 });

    // Build CSV
    const headers = [
      'Invoice No.', 'Booking ID', 'Customer Name', 'Customer Email',
      'Customer Phone', 'Service', 'Invoice Type', 'Total (Rs)',
      'Paid (Rs)', 'Balance (Rs)', 'Status', 'Date',
    ];

    const rows = invoices.map(inv => [
      inv.invoiceNumber,
      inv.bookingId,
      inv.customer?.name || '',
      inv.customer?.email || '',
      inv.customer?.phone || '',
      inv.serviceItems?.[0]?.name || '',
      inv.invoiceType,
      inv.totalAmount,
      inv.paidAmount,
      inv.balanceAmount,
      inv.status,
      new Date(inv.createdAt).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(c => `"${c}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payment_report_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting payment report:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;