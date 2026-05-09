import { Router, Response } from 'express';
import Complaint from '../models/Complaint';
import Staff     from '../models/Staff';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';

const router = Router();
const ALLOWED_ROLES = ['Super Admin', 'Main Admin', 'Customer Support'];

// GET /api/complaints
router.get('/', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { status, search } = req.query;

    const filter: any = {};
    if (status && status !== 'All') filter.status = status;
    if (search) {
      filter.$or = [
        { title:        { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { serviceName:  { $regex: search, $options: 'i' } },
      ];
    }

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    console.error('GET /complaints error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/complaints/:id
router.get('/:id', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) { res.status(404).json({ error: 'Complaint not found' }); return; }
    res.json(complaint);
  } catch (err) {
    console.error('GET /complaints/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/complaints/:id/status
router.put('/:id/status', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'In Progress', 'Resolved'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' }); return;
    }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );
    if (!complaint) { res.status(404).json({ error: 'Complaint not found' }); return; }
    res.json(complaint);
  } catch (err) {
    console.error('PUT /complaints/:id/status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/complaints/:id/priority
router.put('/:id/priority', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { priority } = req.body;
    if (!['High', 'Medium', 'Low'].includes(priority)) {
      res.status(400).json({ error: 'Invalid priority' }); return;
    }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { $set: { priority } },
      { new: true }
    );
    if (!complaint) { res.status(404).json({ error: 'Complaint not found' }); return; }
    res.json(complaint);
  } catch (err) {
    console.error('PUT /complaints/:id/priority error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/complaints/:id/assign
router.put('/:id/assign', authenticate, requireRole('Super Admin', 'Main Admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { staffId } = req.body;

    const staff = await Staff.findById(staffId);
    if (!staff) { res.status(404).json({ error: 'Staff not found' }); return; }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { $set: { assignedStaff: staffId, assignedStaffName: staff.name } },
      { new: true }
    );
    if (!complaint) { res.status(404).json({ error: 'Complaint not found' }); return; }
    res.json(complaint);
  } catch (err) {
    console.error('PUT /complaints/:id/assign error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/complaints/:id/notes
router.post('/:id/notes', authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { note } = req.body;
    if (!note) { res.status(400).json({ error: 'Note is required' }); return; }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          notes: {
            adminId:   req.admin!.id,
            adminName: req.admin!.email,
            note,
            createdAt: new Date(),
          }
        }
      },
      { new: true }
    );
    if (!complaint) { res.status(404).json({ error: 'Complaint not found' }); return; }
    res.json(complaint);
  } catch (err) {
    console.error('POST /complaints/:id/notes error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;