const express             = require('express');
const inventoryController = require('../controllers/inventoryController');
const { protect }         = require('../middleware/authMiddleware');
const { requireRole }     = require('../middleware/roleMiddleware');
const AUTH                = require('../constants/auth');

const router = express.Router();
router.use(protect);

router.get('/low-stock',        requireRole(...AUTH.STAFF_ROLES), inventoryController.getLowStock);
router.get('/',                 requireRole(...AUTH.STAFF_ROLES), inventoryController.getItems);
router.get('/:id',              requireRole(...AUTH.STAFF_ROLES), inventoryController.getItem);
router.get('/:id/transactions', requireRole(...AUTH.STAFF_ROLES), inventoryController.getItemTransactions);

router.post('/',                requireRole(...AUTH.ADMIN_ROLES), inventoryController.createItem);
router.put('/:id',              requireRole(...AUTH.ADMIN_ROLES), inventoryController.updateItem);
router.delete('/:id',           requireRole(...AUTH.ADMIN_ROLES), inventoryController.deleteItem);
router.post('/:id/adjust',      requireRole(...AUTH.STAFF_ROLES), inventoryController.adjustStock);

module.exports = router;