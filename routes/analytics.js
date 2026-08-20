const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');

// Helper function to get date range
const getDateRange = (range) => {
  const now = new Date();
  const ranges = {
    '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    '1y': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
  };
  return { start: ranges[range] || ranges['30d'], end: now };
};

// Revenue analytics
//
// FIX: The original aggregation had a $match filter of status IN ['PAID','PARTIAL']
//      and then inside $group tried to sum refunds with $eq status 'REFUNDED'.
//      Because REFUNDED invoices are excluded by the $match, the refund sum was
//      always 0. Fixed by running a separate parallel aggregation for refunds.
router.get('/revenue', async (req, res, next) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    const [revenueData, refundData] = await Promise.all([
      // Revenue: PAID and PARTIAL invoices
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            status: { $in: ['PAID', 'PARTIAL'] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$paidAmount' }, // Use paidAmount, not totalAmount
            transactions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // FIX: Separate aggregation for REFUNDED invoices so they are not
      //      excluded by the PAID/PARTIAL filter above
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            status: 'REFUNDED',
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            refunds: { $sum: '$totalAmount' },
          },
        },
      ]),
    ]);

    // Merge refund totals into revenue data by date
    const refundByDate = {};
    refundData.forEach(r => { refundByDate[r._id] = r.refunds; });

    const mergedData = revenueData.map(item => ({
      date: item._id,
      revenue: item.revenue,
      transactions: item.transactions,
      refunds: refundByDate[item._id] || 0,
      net: item.revenue - (refundByDate[item._id] || 0),
    }));

    // Summary stats
    const totalRevenue = revenueData.reduce((s, i) => s + i.revenue, 0);
    const totalTransactions = revenueData.reduce((s, i) => s + i.transactions, 0);
    const totalRefunds = refundData.reduce((s, i) => s + i.refunds, 0);

    res.json({
      data: mergedData,
      summary: {
        totalRevenue,
        totalTransactions,
        totalRefunds,
        netRevenue: totalRevenue - totalRefunds,
        avgOrderValue: totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0,
      },
    });

  } catch (error) {
    next(error);
  }
});

// Service analytics
//
// FIX: The $lookup was joining bookings._id (ObjectId) to invoices.bookingId
//      (String) — type mismatch means the join always returned empty arrays and
//      all revenue showed 0. Fixed by joining on the string bookingId field on
//      both sides. Also fixed grouping: Booking has serviceItems[] not serviceType.
router.get('/services', async (req, res, next) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    const serviceData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['completed', 'confirmed', 'in-progress'] },
        },
      },
      // FIX: Join on bookingId (String) <-> bookingId (String) — not _id (ObjectId)
      {
        $lookup: {
          from: 'invoices',
          localField: '_id',          // Booking._id (ObjectId)
          foreignField: 'bookingId',   // Invoice.bookingId (ObjectId ref Booking)
          as: 'invoice',
        },
      },
      {
        $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true },
      },
      // Unwind serviceItems to group by individual service name
      { $unwind: { path: '$serviceItems', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$serviceItems.name',
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$serviceItems.price', 0] } },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const totalRevenue = serviceData.reduce((sum, s) => sum + s.revenue, 0);

    const services = serviceData.map(s => ({
      serviceType: s._id || 'Unknown',
      count: s.count,
      revenue: s.revenue,
      percentage: totalRevenue > 0 ? parseFloat(((s.revenue / totalRevenue) * 100).toFixed(1)) : 0,
    }));

    res.json(services);

  } catch (error) {
    next(error);
  }
});

// Payment method analytics
//
// FIX: The original matched and grouped on 'paymentDetails.method' which does
//      not exist in the Invoice schema. The Invoice model does not have a
//      top-level paymentMethod field either — payment method is inferred from
//      payherePaymentId (online) vs its absence (cash/COD). Fixed aggregation
//      to derive the payment method from the data that is actually in the schema.
router.get('/payment-methods', async (req, res, next) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    // FIX: Derive payment method from payherePaymentId presence and invoiceType
    const paymentData = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['PAID', 'PARTIAL'] },
        },
      },
      {
        $project: {
          totalAmount: 1,
          paidAmount: 1,
          // Derive method: if payherePaymentId exists → Online, else → Cash
          method: {
            $cond: [
              { $and: [{ $ifNull: ['$payherePaymentId', false] }, { $ne: ['$payherePaymentId', ''] }] },
              'Online (PayHere)',
              'Cash / COD',
            ],
          },
        },
      },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          amount: { $sum: '$paidAmount' },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    const totalAmount = paymentData.reduce((sum, m) => sum + m.amount, 0);

    const methods = paymentData.map(m => ({
      method: m._id || 'Unknown',
      count: m.count,
      amount: m.amount,
      percentage: totalAmount > 0 ? parseFloat(((m.amount / totalAmount) * 100).toFixed(1)) : 0,
    }));

    res.json(methods);

  } catch (error) {
    next(error);
  }
});

// Customer analytics
//
// FIX: The original had a $lookup joining invoices.bookingId (String) to
//      bookings._id (ObjectId) — always empty due to type mismatch.
//      The booking sub-document was also never used in the $group stage,
//      so the $lookup was pointless overhead. Removed the unused $lookup.
router.get('/customers', async (req, res, next) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    // FIX: Removed the broken and unused $lookup on bookings
    const customerData = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['PAID', 'PARTIAL'] },
        },
      },
      {
        $group: {
          _id: '$customer.userId',
          name: { $first: '$customer.name' },
          email: { $first: '$customer.email' },
          totalSpent: { $sum: '$paidAmount' },
          bookingCount: { $sum: 1 },
          lastBooking: { $max: '$createdAt' },
          loyaltyPoints: { $sum: { $multiply: ['$paidAmount', 0.1] } },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 50 },
    ]);

    const customers = customerData.map(c => ({
      customerId: c._id || 'unknown',
      name: c.name || 'Unknown Customer',
      email: c.email || 'unknown@example.com',
      totalSpent: c.totalSpent,
      bookingCount: c.bookingCount,
      lastBooking: c.lastBooking ? new Date(c.lastBooking).toISOString().split('T')[0] : 'N/A',
      loyaltyPoints: Math.floor(c.loyaltyPoints),
    }));

    res.json(customers);

  } catch (error) {
    next(error);
  }
});

// Dashboard summary
router.get('/summary', async (req, res, next) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    const [revenueStats, customerStats, bookingStats] = await Promise.all([
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            status: { $in: ['PAID', 'PARTIAL'] },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$paidAmount' },
            totalTransactions: { $sum: 1 },
            avgOrderValue: { $avg: '$paidAmount' },
          },
        },
      ]),

      Invoice.distinct('customer.userId', {
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['PAID', 'PARTIAL'] },
      }),

      Booking.countDocuments({
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['completed', 'confirmed', 'in-progress'] },
      }),
    ]);

    const summary = {
      totalRevenue: revenueStats[0]?.totalRevenue || 0,
      totalTransactions: revenueStats[0]?.totalTransactions || 0,
      avgOrderValue: Math.round(revenueStats[0]?.avgOrderValue || 0),
      totalCustomers: customerStats.length,
      totalBookings: bookingStats,
      conversionRate:
        bookingStats > 0
          ? parseFloat((((revenueStats[0]?.totalTransactions || 0) / bookingStats) * 100).toFixed(1))
          : 0,
    };

    res.json(summary);

  } catch (error) {
    next(error);
  }
});

module.exports = router;