import { Router, Response } from 'express';
import Review from '../models/Review';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';

const router = Router();
const ALLOWED_ROLES = ['Super Admin', 'Main Admin', 'Customer Support'];

// GET /api/reviews/stats
router.get('/stats', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    // Rating distribution (approved only)
    const stats = await Review.aggregate([
      { $match: { status: 'Approved' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    const distribution = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: stats.find(s => s._id === star)?.count || 0,
    }));

    const total    = distribution.reduce((sum, s) => sum + s.count, 0);
    const average  = total > 0
      ? distribution.reduce((sum, s) => sum + s.star * s.count, 0) / total
      : 0;

    // Status counts — all reviews
    const statusCounts = await Review.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts = {
      All:      await Review.countDocuments(),
      Pending:  statusCounts.find(s => s._id === 'Pending')?.count  || 0,
      Approved: statusCounts.find(s => s._id === 'Approved')?.count || 0,
      Hidden:   statusCounts.find(s => s._id === 'Hidden')?.count   || 0,
    };

    res.json({ distribution, total, average: average.toFixed(1), counts });
  } catch (err) {
    console.error('GET /reviews/stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reviews
router.get('/', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { status, search } = req.query;

    const filter: any = {};
    if (status && status !== 'All') filter.status = status;
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { serviceName:  { $regex: search, $options: 'i' } },
        { content:      { $regex: search, $options: 'i' } },
      ];
    }

    const reviews = await Review.find(filter).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error('GET /reviews error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/reviews/:id/approve
router.put('/:id/approve', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'Approved' } },
      { new: true }
    );
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    res.json(review);
  } catch (err) {
    console.error('PUT /reviews/:id/approve error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/reviews/:id/hide
router.put('/:id/hide', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'Hidden' } },
      { new: true }
    );
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    res.json(review);
  } catch (err) {
    console.error('PUT /reviews/:id/hide error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/reviews/:id
router.delete('/:id', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    res.json({ message: 'Review deleted' });
  } catch (err) {
    console.error('DELETE /reviews/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;