const express    = require('express');
const controller = require('../controllers/consumptionRateController');
const { protect }     = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const AUTH            = require('../constants/auth');

const router = express.Router();
router.use(protect);

// All rate endpoints are admin-only — staff should not change consumption targets
router.get('/',                       requireRole(...AUTH.ADMIN_ROLES), controller.list);
router.get('/:serviceType',           requireRole(...AUTH.ADMIN_ROLES), controller.getByServiceType);
router.post('/',                      requireRole(...AUTH.ADMIN_ROLES), controller.upsert);
router.delete('/:id',                 requireRole(...AUTH.ADMIN_ROLES), controller.deleteRate);

module.exports = router;
