import { Router, Response } from 'express';
import Staff from '../models/Staff';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { upload } from '../config/upload';

const router = Router();

const ALLOWED_ROLES = ['Super Admin', 'Main Admin', 'Operations Manager'];

// GET /api/staff
router.get('/', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { search, status } = req.query;

    const filter: any = {};

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { nic:   { $regex: search, $options: 'i' } },
      ];
    }

    const staff = await Staff.find(filter).sort({ createdAt: -1 });
    res.json(staff);
  } catch (err) {
    console.error('GET /staff error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/staff/available
router.get('/available', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const staff = await Staff.find({ status: 'Active' }).sort({ name: 1 });
    res.json(staff);
  } catch (err) {
    console.error('GET /staff/available error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/staff/:id
router.get('/:id', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) { res.status(404).json({ error: 'Staff not found' }); return; }
    res.json(staff);
  } catch (err) {
    console.error('GET /staff/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/staff
router.post('/', authenticate, requireRole('Super Admin', 'Main Admin'), upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    console.log('POST /staff body:', req.body);
    const { name, email, phone, nic, address, specifications, status } = req.body;

    // Parse specifications — sent as JSON string from form data
    let specs: string[] = [];
    if (specifications) {
      specs = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
    }

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : '';

    const staff = await Staff.create({
      name,
      email,
      phone,
      nic,
      address:        address || '',
      specifications: specs,
      status:         status  || 'Active',
      photoUrl,
      createdBy:      req.admin!.id,
    });

    res.status(201).json(staff);
  } catch (err: any) {
    console.error('POST /staff error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      res.status(409).json({ error: `${field} already exists` });
      return;
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/staff/:id
router.put('/:id', authenticate, requireRole('Super Admin', 'Main Admin'), upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) { res.status(404).json({ error: 'Staff not found' }); return; }

    const { address, specifications, status, phone } = req.body;

    let specs: string[] = staff.specifications;
    if (specifications) {
      specs = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
    }

    const updateData: any = {
      address:        address || staff.address,
      specifications: specs,
      status:         status  || staff.status,
      phone:          phone   || staff.phone,
    };

    if (req.file) {
      updateData.photoUrl = `/uploads/${req.file.filename}`;
    }

    const updated = await Staff.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error('PUT /staff/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/staff/:id/deactivate
router.put('/:id/deactivate', authenticate, requireRole('Super Admin', 'Main Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) { res.status(404).json({ error: 'Staff not found' }); return; }

    await Staff.findByIdAndUpdate(req.params.id, { status: 'Inactive' });
    res.json({ message: 'Staff deactivated' });
  } catch (err) {
    console.error('PUT /staff/:id/deactivate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/staff/:id/activate
router.put('/:id/activate', authenticate, requireRole('Super Admin', 'Main Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) { res.status(404).json({ error: 'Staff not found' }); return; }

    await Staff.findByIdAndUpdate(req.params.id, { status: 'Active' });
    res.json({ message: 'Staff activated' });
  } catch (err) {
    console.error('PUT /staff/:id/activate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/staff/:id
router.delete('/:id', authenticate, requireRole('Super Admin', 'Main Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) { res.status(404).json({ error: 'Staff not found' }); return; }

    await Staff.findByIdAndDelete(req.params.id);
    res.json({ message: 'Staff deleted successfully' });
  } catch (err) {
    console.error('DELETE /staff/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;