import { Router, Response } from 'express';
import Booking  from '../models/Booking';
import Staff    from '../models/Staff';
import Customer from '../models/Customer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';

const router        = Router();
const MANAGER_ROLES = ['Super Admin', 'Main Admin'];

// GET /api/reports/bookings
router.get('/bookings', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { from, to, service, status } = req.query;
    const filter: any = {};

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from; // string comparison works for YYYY-MM-DD
      if (to)   filter.date.$lte = to;
    }
    if (service && service !== 'All') filter.serviceCategory = service;
    if (status  && status  !== 'All') filter.status          = status;

    const bookings = await Booking.find(filter)
      .sort({ date: -1 })
      .select('bookingId customerName serviceName serviceCategory date time status price paidAmount balanceAmount paymentMethod paymentStatus assignedStaffName');

    const summary = {
  total:     bookings.length,
  completed: bookings.filter(b => b.status === 'completed').length,
  cancelled: bookings.filter(b => b.status === 'cancelled').length,
  pending:   bookings.filter(b => ['pending','confirmed-unpaid'].includes(b.status)).length,
  revenue:   bookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + b.paidAmount, 0),
};
res.json({ bookings, summary });
  } catch (err) {
    console.error('GET /reports/bookings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/payments
router.get('/payments', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { period, method } = req.query;
    const filter: any = { paymentStatus: 'paid' };

    if (period) {
      const d    = new Date();
      if (period === 'This Month')    d.setDate(1);
      if (period === 'Last 3 Months') d.setMonth(d.getMonth() - 3);
      if (period === 'Last 6 Months') d.setMonth(d.getMonth() - 6);
      if (period === 'This Year')     d.setMonth(0, 1);
      filter.date = { $gte: d.toISOString().split('T')[0] };
    }
    if (method && method !== 'All') filter.paymentMethod = method;

    const bookings = await Booking.find(filter)
      .sort({ date: -1 })
      .select('bookingId customerName serviceName date price paidAmount paymentMethod paymentMethodName paymentStatus');

    const total = bookings.reduce((sum, b) => sum + b.paidAmount, 0);
    res.json({ bookings, total, count: bookings.length });
  } catch (err) {
    console.error('GET /reports/payments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/staff-performance
router.get('/staff-performance', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { period, staff } = req.query;
    const bookingFilter: any = { status: 'completed' };

    if (period) {
      const d = new Date();
      if (period === 'This Month')    d.setDate(1);
      if (period === 'Last 3 Months') d.setMonth(d.getMonth() - 3);
      if (period === 'Last 6 Months') d.setMonth(d.getMonth() - 6);
      bookingFilter.date = { $gte: d.toISOString().split('T')[0] };
    }
    if (staff && staff !== 'All') bookingFilter.assignedStaffName = staff;

    const staffList = await Staff.find().select('name rating jobsCompleted status');
    const bookings  = await Booking.find(bookingFilter);

    const report = staffList.map(s => ({
      name:          s.name,
      rating:        s.rating,
      jobsCompleted: bookings.filter(b =>
        b.assignedStaffName === s.name ||
        b.assignedTeam.some(t => t.staffName === s.name)
      ).length,
      status: s.status,
    }));

    const summary = {
  totalStaff:  report.length,
  activeStaff: report.filter(r => r.status === 'Active').length,
  totalJobs:   report.reduce((s, r) => s + r.jobsCompleted, 0),
  avgRating:   report.length > 0
    ? (report.reduce((s, r) => s + r.rating, 0) / report.length).toFixed(2)
    : '0.00',
};
res.json({ staff: report, summary });
  } catch (err) {
    console.error('GET /reports/staff-performance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/customers
router.get('/customers', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { period, status } = req.query;
    const filter: any = {};

    if (status && status !== 'All') filter.status = status;
    if (period) {
      const d = new Date();
      if (period === 'This Month')    d.setDate(1);
      if (period === 'Last 3 Months') d.setMonth(d.getMonth() - 3);
      if (period === 'Last 6 Months') d.setMonth(d.getMonth() - 6);
      filter.createdAt = { $gte: d };
    }

    const customers = await Customer.find(filter)
      .select('name email phone status totalBookings totalSpent loyaltyPoints joinDate lastBooking')
      .sort({ totalSpent: -1 });

    res.json(customers);
  } catch (err) {
    console.error('GET /reports/customers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;