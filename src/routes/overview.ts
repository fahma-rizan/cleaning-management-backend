import { Router, Response } from 'express';
import Booking from '../models/Booking';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';

const router = Router();
const ALL    = ['Super Admin', 'Main Admin', 'Operations Manager', 'Customer Support'];

// GET /api/overview/stats
router.get('/stats', authenticate, requireRole(...ALL), async (req: AuthRequest, res: Response) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0]; // "2026-05-05"

    const todayBookings = await Booking.find({ date: todayStr });

    const todayOrders    = todayBookings.length;
    const todayCompleted = todayBookings.filter(b => b.status === 'completed').length;
    const todayCancelled = todayBookings.filter(b => b.status === 'cancelled').length;
    const todayPending   = todayBookings.filter(b =>
      ['pending', 'confirmed-unpaid'].includes(b.status)
    ).length;
    const todayRevenue   = todayBookings
      .filter(b => b.paymentStatus === 'paid')
      .reduce((sum, b) => sum + b.paidAmount, 0);

    res.json({ todayOrders, todayCompleted, todayCancelled, todayPending, todayRevenue });
  } catch (err) {
    console.error('GET /overview/stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/overview/revenue-chart
router.get('/revenue-chart', authenticate, requireRole(...ALL), async (req: AuthRequest, res: Response) => {
  try {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now        = new Date();
    const data       = [];

    for (let i = 6; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year  = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const prefix = `${year}-${month}`; // "2026-05"

      // date field is stored as string "YYYY-MM-DD" so use regex
      const bookings = await Booking.find({
        date:          { $regex: `^${prefix}` },
        paymentStatus: 'paid',
      });

      const revenue = bookings.reduce((sum, b) => sum + b.paidAmount, 0);
      data.push({ month: monthNames[d.getMonth()], revenue });
    }

    res.json(data);
  } catch (err) {
    console.error('GET /overview/revenue-chart error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/overview/service-breakdown
router.get('/service-breakdown', authenticate, requireRole(...ALL), async (req: AuthRequest, res: Response) => {
  try {
    const categories = [
      { name: 'Home/Office Cleaning',     dbValue: 'home',    color: '#7C3AED' },
      { name: 'Laundry Cleaning',         dbValue: 'laundry', color: '#3B82F6' },
      { name: 'Shampoo Vacuum Cleaning',  dbValue: 'shampoo', color: '#F59E0B' },
      { name: 'Curtains Cleaning',        dbValue: 'curtain', color: '#D946EF' },
    ];

    const data = await Promise.all(
      categories.map(async (cat) => {
        // Get all service names in this category from pricelists
        const PriceList = (await import('../models/PriceList')).default;
        const services  = await PriceList.find({ category: cat.dbValue }).select('serviceName');
        const names     = services.map(s => s.serviceName);

        // Count bookings that match any service in this category
        const count = await Booking.countDocuments({
          $or: [
            { serviceCategory: { $in: names } },
            { serviceName:     { $in: names } },
            { serviceType:     { $regex: cat.dbValue, $options: 'i' } },
          ]
        });

        return { name: cat.name, value: count, color: cat.color };
      })
    );

    // If no real bookings yet, show equal distribution so chart renders
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const result = total === 0
      ? data.map(d => ({ ...d, value: 1 }))
      : data;

    res.json(result);
  } catch (err) {
    console.error('GET /overview/service-breakdown error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/overview/recent-bookings
router.get('/recent-bookings', authenticate, requireRole(...ALL), async (req: AuthRequest, res: Response) => {
  try {
    const showAll = req.query.all === 'true';

    const query = Booking.find()
      .sort({ scheduledAt: -1, date: -1, createdAt: -1 })
      .select('bookingId customerName serviceName serviceCategory date time status price paidAmount paymentStatus scheduledAt');

    if (!showAll) query.limit(5);

    const bookings = await query;
    res.json(bookings);
  } catch (err) {
    console.error('GET /overview/recent-bookings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;