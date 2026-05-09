import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';

const router = Router();
const MANAGER_ROLES = ['Super Admin', 'Main Admin'];

const getAssignableRoles = (role: string): string[] => {
  if (role === 'Super Admin') return ['Main Admin', 'Operations Manager', 'Customer Support'];
  if (role === 'Main Admin')  return ['Operations Manager', 'Customer Support'];
  return [];
};

// GET /api/admins
router.get('/', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: 1 });
    res.json(admins);
  } catch (err) {
    console.error('GET /admins error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admins/:id
router.get('/:id', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const admin = await Admin.findById(req.params.id).select('-password');
    if (!admin) { res.status(404).json({ error: 'Admin not found' }); return; }
    res.json(admin);
  } catch (err) {
    console.error('GET /admins/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admins
router.post('/', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    console.log('POST /admins body:', req.body);
    const { name, email, password, phone, address, role } = req.body;
    const currentRole = req.admin!.role;

    const assignable = getAssignableRoles(currentRole);
    if (!assignable.includes(role)) {
      res.status(403).json({ error: `You cannot assign the role: ${role}` });
      return;
    }

    const hash = await bcrypt.hash(password || 'Default@123', 10);
    const admin = await Admin.create({
      name,
      email,
      password: hash,
      phone:    phone   || '',
      address:  address || '',
      role,
      createdBy: req.admin!.id,
    });

    const adminObj  = admin.toObject() as any;
    delete adminObj.password;
    res.status(201).json(adminObj);
  } catch (err: any) {
    console.error('POST /admins error:', err);
    if (err.code === 11000) { res.status(409).json({ error: 'Email already exists' }); return; }
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admins/:id/deactivate
router.put('/:id/deactivate', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const target = await Admin.findById(req.params.id);
    if (!target) { res.status(404).json({ error: 'Admin not found' }); return; }
    if (target.isSuperAdmin) { res.status(403).json({ error: 'Super Admin cannot be deactivated' }); return; }
    if (req.admin!.role === 'Main Admin' && target.role === 'Main Admin') {
      res.status(403).json({ error: 'Not permitted' }); return;
    }

    await Admin.findByIdAndUpdate(req.params.id, { status: 'Inactive' });
    res.json({ message: 'Admin deactivated' });
  } catch (err) {
    console.error('PUT /admins/:id/deactivate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admins/:id/activate
router.put('/:id/activate', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const target = await Admin.findById(req.params.id);
    if (!target) { res.status(404).json({ error: 'Admin not found' }); return; }

    if (target.isSuperAdmin) {
      res.status(403).json({ error: 'Super Admin status cannot be modified' });
      return;
    }

    if (req.admin!.role === 'Main Admin' && target.role === 'Main Admin') {
      res.status(403).json({ error: 'Not permitted' });
      return;
    }

    await Admin.findByIdAndUpdate(req.params.id, { status: 'Active' });
    res.json({ message: 'Admin activated' });
  } catch (err) {
    console.error('PUT /admins/:id/activate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admins/:id
router.put('/:id', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const target = await Admin.findById(req.params.id);
    if (!target) { res.status(404).json({ error: 'Admin not found' }); return; }
    if (target.isSuperAdmin) { res.status(403).json({ error: 'Super Admin cannot be modified' }); return; }
    if (req.admin!.role === 'Main Admin' && target.role === 'Main Admin') {
      res.status(403).json({ error: 'Not permitted' }); return;
    }

    const { role, status, name, phone, address } = req.body;
    const updated = await Admin.findByIdAndUpdate(
      req.params.id,
      { role, status, name, phone, address },
      { new: true }
    ).select('-password');

    res.json(updated);
  } catch (err) {
    console.error('PUT /admins/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admins/:id
router.delete('/:id', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const target = await Admin.findById(req.params.id);
    if (!target) { res.status(404).json({ error: 'Admin not found' }); return; }
    if (target.isSuperAdmin) { res.status(403).json({ error: 'Super Admin cannot be deleted' }); return; }
    if (req.admin!.role === 'Main Admin' && target.role === 'Main Admin') {
      res.status(403).json({ error: 'Not permitted' }); return;
    }

    await Admin.findByIdAndDelete(req.params.id);
    res.json({ message: 'Admin deleted' });
  } catch (err) {
    console.error('DELETE /admins/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;