'use strict';
const InventoryItem = require('../models/InventoryItem');
const StockLog      = require('../models/StockLog');
const alertService  = require('../services/stockAlertService');

// Lazy require to avoid circular dependency chains
const getLowStockAlertService = () => require('../services/lowStockAlertService');

// GET /api/inventory/stock?lowStock=true
exports.getAllStock = async (req, res) => {
  try {
    const filter = { isActive: { $ne: false } };
    if (req.query.lowStock === 'true') {
      filter.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
    }
    const items = await InventoryItem.find(filter).sort({ name: 1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/inventory/stock/:id
exports.getStockById = async (req, res) => {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, isActive: { $ne: false } });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/inventory/stock
exports.createStock = async (req, res) => {
  try {
    const { name, sku, type, unit, lowStockThreshold, costPerUnit } = req.body;
    if (!name || !sku || !type || !unit || lowStockThreshold === undefined) {
      return res.status(400).json({
        success: false,
        message: 'name, sku, type, unit, and lowStockThreshold are required',
      });
    }

    const item = await InventoryItem.create({
      name,
      sku,
      type,
      unit,
      lowStockThreshold,
      costPerUnit: costPerUnit || 0,
    });

    if (item.quantity <= item.lowStockThreshold) {
      await alertService.triggerLowStockAlert(item);
    }

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/inventory/stock/:id
exports.updateStock = async (req, res) => {
  try {
    const { name, unit, lowStockThreshold, costPerUnit } = req.body;
    const updates = {};
    if (name              !== undefined) updates.name              = name;
    if (unit              !== undefined) updates.unit              = unit;
    if (lowStockThreshold !== undefined) updates.lowStockThreshold = lowStockThreshold;
    if (costPerUnit       !== undefined) updates.costPerUnit       = costPerUnit;

    const item = await InventoryItem.findOneAndUpdate(
      { _id: req.params.id, isActive: { $ne: false } },
      updates,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/inventory/stock/:id/restock
exports.restockItem = async (req, res) => {
  try {
    const { quantity, performedBy, costPerUnit } = req.body;
    if (!quantity || quantity <= 0 || !performedBy) {
      return res.status(400).json({
        success: false,
        message: 'quantity (> 0) and performedBy are required',
      });
    }

    const updates = { $inc: { quantity } };
    if (costPerUnit !== undefined) updates.$set = { costPerUnit };

    const item = await InventoryItem.findOneAndUpdate(
      { _id: req.params.id, isActive: { $ne: false } },
      updates,
      { new: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    await StockLog.create({
      itemId:       item._id,
      itemName:     item.name,
      movementType: 'restock',
      quantity,
      performedBy,
      unitCost:     costPerUnit !== undefined ? costPerUnit : item.costPerUnit,
    });

    if (item.quantity > item.lowStockThreshold) {
      await alertService.resolveLowStockAlert(item._id, performedBy, item.quantity);
    }

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/inventory/stock/:id/deduct
exports.deductStock = async (req, res) => {
  try {
    const { quantity, performedBy, bookingId } = req.body;
    if (!quantity || quantity <= 0 || !performedBy) {
      return res.status(400).json({
        success: false,
        message: 'quantity (> 0) and performedBy are required',
      });
    }

    const current = await InventoryItem.findOne({ _id: req.params.id, isActive: { $ne: false } });
    if (!current) return res.status(404).json({ success: false, message: 'Item not found' });
    if (current.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${current.quantity} ${current.unit}`,
      });
    }

    const item = await InventoryItem.findOneAndUpdate(
      { _id: req.params.id, isActive: { $ne: false } },
      { $inc: { quantity: -quantity } },
      { new: true }
    );

    const logEntry = {
      itemId:       item._id,
      itemName:     item.name,
      movementType: 'deduction',
      quantity,
      performedBy,
      unitCost:     item.costPerUnit,
    };
    if (bookingId) logEntry.bookingId = bookingId;
    await StockLog.create(logEntry);

    if (item.quantity <= item.lowStockThreshold) {
      await alertService.triggerLowStockAlert(item);
    }

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/inventory/stock/alerts
exports.getLowStockAlerts = async (req, res) => {
  try {
    const alerts = await getLowStockAlertService().getActiveAlerts();
    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/inventory/stock/:id/logs
exports.getStockLogs = async (req, res) => {
  try {
    const logs = await StockLog.find({ itemId: req.params.id })
      .populate('performedBy', 'name email')
      .sort({ timestamp: -1 });
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
