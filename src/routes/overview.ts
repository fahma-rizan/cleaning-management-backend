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
    const result = await Booking.aggregate([
      { $group: { _id: '$serviceCategory', value: { $sum: 1 } } },
      { $sort:  { value: -1 } },
      { $limit: 5 },
    ]);

    const colors = ['#7C3AED', '#3B82F6', '#F59E0B', '#D946EF', '#64748B'];
    const data   = result.map((r, i) => ({
      name:  r._id || 'Other',
      value: r.value,
      color: colors[i] || '#64748B',
    }));

    res.json(data);
  } catch (err) {
    console.error('GET /overview/service-breakdown error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/overview/recent-bookings
router.get('/recent-bookings', authenticate, requireRole(...ALL), async (req: AuthRequest, res: Response) => {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('bookingId customerName serviceName serviceCategory date time status price paidAmount paymentStatus');

    res.json(bookings);
  } catch (err) {
    console.error('GET /overview/recent-bookings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;