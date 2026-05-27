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
router.get('/revenue', async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    // Aggregate revenue data by date
    const revenueData = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['PAID', 'PARTIAL'] }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          revenue: { $sum: '$totalAmount' },
          transactions: { $sum: 1 },
          refunds: { $sum: { $cond: [{ $eq: ['$status', 'REFUNDED'] }, '$totalAmount', 0] } }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Calculate summary stats
    const summary = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['PAID', 'PARTIAL'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalTransactions: { $sum: 1 },
          totalRefunds: {
            $sum: { $cond: [{ $eq: ['$status', 'REFUNDED'] }, '$totalAmount', 0] }
          }
        }
      }
    ]);

    const summaryStats = summary[0] || {
      totalRevenue: 0,
      totalTransactions: 0,
      totalRefunds: 0
    };

    // Calculate average order value
    const avgOrderValue = summaryStats.totalTransactions > 0
      ? summaryStats.totalRevenue / summaryStats.totalTransactions
      : 0;

    res.json({
      data: revenueData.map(item => ({
        date: item._id,
        revenue: item.revenue,
        transactions: item.transactions,
        refunds: item.refunds
      })),
      summary: {
        ...summaryStats,
        avgOrderValue: Math.round(avgOrderValue)
      }
    });

  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
});

// Service analytics
router.get('/services', async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    const serviceData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['COMPLETED', 'CONFIRMED'] }
        }
      },
      {
        $lookup: {
          from: 'invoices',
          localField: '_id',
          foreignField: 'bookingId',
          as: 'invoice'
        }
      },
      {
        $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: '$serviceType',
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$invoice.totalAmount', 0] } }
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]);

    const totalRevenue = serviceData.reduce((sum, service) => sum + service.revenue, 0);

    const services = serviceData.map(service => ({
      serviceType: service._id || 'Unknown',
      count: service.count,
      revenue: service.revenue,
      percentage: totalRevenue > 0 ? (service.revenue / totalRevenue) * 100 : 0
    }));

    res.json(services);

  } catch (error) {
    console.error('Error fetching service analytics:', error);
    res.status(500).json({ error: 'Failed to fetch service analytics' });
  }
});

// Payment method analytics
router.get('/payment-methods', async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    const paymentData = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['PAID', 'PARTIAL'] },
          'paymentDetails.method': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$paymentDetails.method',
          count: { $sum: 1 },
          amount: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { amount: -1 }
      }
    ]);

    const totalAmount = paymentData.reduce((sum, method) => sum + method.amount, 0);

    const methods = paymentData.map(method => ({
      method: method._id || 'Unknown',
      count: method.count,
      amount: method.amount,
      percentage: totalAmount > 0 ? (method.amount / totalAmount) * 100 : 0
    }));

    res.json(methods);

  } catch (error) {
    console.error('Error fetching payment method analytics:', error);
    res.status(500).json({ error: 'Failed to fetch payment method analytics' });
  }
});

// Customer analytics
router.get('/customers', async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    const customerData = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['PAID', 'PARTIAL'] }
        }
      },
      {
        $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          as: 'booking'
        }
      },
      {
        $unwind: { path: '$booking', preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: '$customer.userId',
          name: { $first: '$customer.name' },
          email: { $first: '$customer.email' },
          totalSpent: { $sum: '$totalAmount' },
          bookingCount: { $sum: 1 },
          lastBooking: { $max: '$createdAt' },
          loyaltyPoints: { $sum: { $multiply: ['$totalAmount', 0.1] } } // 10 points per Rs. 100
        }
      },
      {
        $sort: { totalSpent: -1 }
      },
      {
        $limit: 50
      }
    ]);

    const customers = customerData.map(customer => ({
      customerId: customer._id || 'unknown',
      name: customer.name || 'Unknown Customer',
      email: customer.email || 'unknown@example.com',
      totalSpent: customer.totalSpent,
      bookingCount: customer.bookingCount,
      lastBooking: customer.lastBooking ? new Date(customer.lastBooking).toISOString().split('T')[0] : 'N/A',
      loyaltyPoints: Math.floor(customer.loyaltyPoints)
    }));

    res.json(customers);

  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({ error: 'Failed to fetch customer analytics' });
  }
});

// Dashboard summary
router.get('/summary', async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    const [revenueStats, customerStats, bookingStats] = await Promise.all([
      // Revenue stats
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            status: { $in: ['PAID', 'PARTIAL'] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            totalTransactions: { $sum: 1 },
            avgOrderValue: { $avg: '$totalAmount' }
          }
        }
      ]),

      // Customer stats
      Invoice.distinct('customer.userId', {
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['PAID', 'PARTIAL'] }
      }),

      // Booking stats
      Booking.countDocuments({
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['COMPLETED', 'CONFIRMED'] }
      })
    ]);

    const summary = {
      totalRevenue: revenueStats[0]?.totalRevenue || 0,
      totalTransactions: revenueStats[0]?.totalTransactions || 0,
      avgOrderValue: Math.round(revenueStats[0]?.avgOrderValue || 0),
      totalCustomers: customerStats.length,
      totalBookings: bookingStats,
      conversionRate: bookingStats > 0 ? ((revenueStats[0]?.totalTransactions || 0) / bookingStats) * 100 : 0
    };

    res.json(summary);

  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
});

module.exports = router;