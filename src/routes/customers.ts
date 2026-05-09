import { Router, Response } from 'express';
import Customer from '../models/Customer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';

const router = Router();

const ALLOWED_ROLES = ['Super Admin', 'Main Admin', 'Customer Support'];

// GET /api/customers
router.get('/', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;

    const filter: any = {};
    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(filter).sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) {
    console.error('GET /customers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers/:id
router.get('/:id', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) { res.status(404).json({ error: 'Customer not found' }); return; }
    res.json(customer);
  } catch (err) {
    console.error('GET /customers/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/customers/:id/status
router.put('/:id/status', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive', 'blocked'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value' });
      return;
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) { res.status(404).json({ error: 'Customer not found' }); return; }

    const updated = await Customer.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error('PUT /customers/:id/status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
