const inventoryService = require('../services/inventoryService');

const createItem = async (req, res) => {
  try {
    const item = await inventoryService.createItem(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getItems = async (req, res) => {
  try {
    const { type, lowStock, page, limit } = req.query;
    const data = await inventoryService.getAllItems({
      type,
      lowStock: lowStock === 'true',
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getItem = async (req, res) => {
  try {
    const item = await inventoryService.getItemById(req.params.id);
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const item = await inventoryService.updateItem(req.params.id, req.body);
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    await inventoryService.softDeleteItem(req.params.id);
    res.status(200).json({ success: true, message: 'Item deactivated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const adjustStock = async (req, res) => {
  try {
    const result = await inventoryService.adjustStock(req.params.id, {
      ...req.body,
      performedBy: req.user._id,
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getLowStock = async (req, res) => {
  try {
    const items = await inventoryService.getLowStockItems();
    res.status(200).json({ success: true, data: items });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getItemTransactions = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const data = await inventoryService.getItemTransactions(req.params.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  createItem, getItems, getItem, updateItem, deleteItem,
  adjustStock, getLowStock, getItemTransactions,
};
