import { Router, Response } from 'express';
import Settings  from '../models/Settings';
import PriceList from '../models/PriceList';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';

const router        = Router();
const MANAGER_ROLES = ['Super Admin', 'Main Admin'];

// GET /api/settings — load general + business + all pricelists
router.get('/', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    const priceLists = await PriceList.find().sort({ serviceId: 1 });

    res.json({ ...settings.toObject(), priceLists });
  } catch (err) {
    console.error('GET /settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/settings/general
router.put('/general', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { businessHours, operatingDays, cancellationPolicy, durations, holidays } = req.body;

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { 'general.businessHours': businessHours, 'general.operatingDays': operatingDays, 'general.cancellationPolicy': cancellationPolicy, 'general.durations': durations, 'general.holidays': holidays, updatedBy: req.admin!.id } },
      { new: true, upsert: true }
    );

    res.json(settings);
  } catch (err) {
    console.error('PUT /settings/general error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/settings/business
router.put('/business', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { business: req.body, updatedBy: req.admin!.id } },
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (err) {
    console.error('PUT /settings/business error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/settings/pricing/:serviceId — update one service's pricing
router.put('/pricing/:serviceId', authenticate, requireRole(...MANAGER_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const serviceId = parseInt(req.params.serviceId as string);
    const { pricing } = req.body;

    const updated = await PriceList.findOneAndUpdate(
      { serviceId },
      { $set: { pricing } },
      { new: true }
    );

    if (!updated) { res.status(404).json({ error: 'Service not found' }); return; }
    res.json(updated);
  } catch (err) {
    console.error('PUT /settings/pricing/:serviceId error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;