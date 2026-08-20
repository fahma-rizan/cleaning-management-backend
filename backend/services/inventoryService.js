const mongoose             = require('mongoose');
const InventoryItem        = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const Bottle               = require('../models/Bottle');
const INVENTORY            = require('../constants/inventory');

// Lazy require to break the circular dependency chain:
// inventoryService → lowStockAlertService → InventoryItem (fine)
// lowStockAlertService does NOT require inventoryService, so lazy load is enough.
const getLowStockAlertService = () => require('./lowStockAlertService');

const createItem = async (data) => {
  const existing = await InventoryItem.findOne({ sku: data.sku.toUpperCase() });
  if (existing) throw new Error('An item with this SKU already exists');
  return InventoryItem.create(data);
};

const getAllItems = async ({ type, lowStock, page = 1, limit = 20 } = {}) => {
  const filter = { isActive: { $ne: false } };
  if (type) filter.type = type;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    InventoryItem.find(filter).skip(skip).limit(limit).lean({ virtuals: true }),
    InventoryItem.countDocuments(filter),
  ]);

  const result = lowStock ? items.filter((i) => i.isLowStock) : items;
  return { items: result, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const getItemById = async (itemId) => {
  const item = await InventoryItem.findOne({ _id: itemId, isActive: { $ne: false } });
  if (!item) throw new Error('Item not found');
  return item;
};

const updateItem = async (itemId, updates) => {
  const item = await InventoryItem.findOneAndUpdate(
    { _id: itemId, isActive: { $ne: false } },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!item) throw new Error('Item not found');
  return item;
};

const softDeleteItem = async (itemId) => {
  const item = await InventoryItem.findByIdAndUpdate(itemId, { isActive: false }, { new: true });
  if (!item) throw new Error('Item not found');
};

/**
 * adjustStock — manual stock adjustment (restock, deduct, return, adjustment).
 *
 * costPerUnit is snapshotted from the item at transaction time so that future
 * price changes don't retroactively alter historical cost reports.
 *
 * The stock update and transaction log are wrapped in session.withTransaction()
 * so a crash between the two writes cannot leave stock updated with no audit trail.
 *
 * On restocks: resolve any existing low-stock alert (the shortage is being fixed).
 * On deductions: check if the new quantity triggers a low-stock alert.
 */
const adjustStock = async (itemId, { type, quantity, reference, notes, performedBy }) => {
  const session = await mongoose.startSession();
  let result;

  await session.withTransaction(async () => {
    const item = await InventoryItem.findOne({ _id: itemId, isActive: { $ne: false } }).session(session);
    if (!item) throw new Error('Item not found');

    const previousQty = item.quantity;
    let newQty;

    switch (type) {
      case INVENTORY.TRANSACTION_TYPES.DEDUCT:
        if (item.quantity < quantity) {
          throw new Error(`Insufficient stock. Available: ${item.quantity} ${item.unit}`);
        }
        newQty = previousQty - quantity;
        break;
      case INVENTORY.TRANSACTION_TYPES.RETURN:
      case INVENTORY.TRANSACTION_TYPES.RESTOCK:
        newQty = previousQty + quantity;
        break;
      case INVENTORY.TRANSACTION_TYPES.ADJUSTMENT:
        newQty = quantity; // absolute set
        break;
      default:
        throw new Error('Invalid transaction type');
    }

    item.quantity = newQty;
    await item.save({ session });

    // costPerUnit snapshot: locks historical cost even if the item's price changes later
    await InventoryTransaction.create(
      [{
        itemId, type, quantity, previousQty, newQty,
        costPerUnit: item.costPerUnit,
        reference, notes, performedBy,
      }],
      { session }
    );

    result = { item, isLowStock: newQty <= item.lowStockThreshold };
  });

  session.endSession();

  // Post-transaction alert checks are intentionally outside the transaction —
  // alert creation/resolution is best-effort and must not roll back a completed stock update.
  const lowStockAlertService = getLowStockAlertService();

  if (type === INVENTORY.TRANSACTION_TYPES.RESTOCK) {
    await lowStockAlertService.resolveAlert(itemId, performedBy, result.item.quantity).catch(() => {});
  } else if (
    type === INVENTORY.TRANSACTION_TYPES.DEDUCT ||
    type === INVENTORY.TRANSACTION_TYPES.ADJUSTMENT
  ) {
    await lowStockAlertService.checkAndCreateLowStockAlert(itemId).catch(() => {});
  }

  return result;
};

const getLowStockItems = async () => {
  const items = await InventoryItem.find({ isActive: { $ne: false } }).lean({ virtuals: true });
  return items.filter((i) => i.isLowStock);
};

const getItemTransactions = async (itemId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    InventoryTransaction.find({ itemId })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    InventoryTransaction.countDocuments({ itemId }),
  ]);

  return { transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

/**
 * createBottlesOnRestock — creates individual Bottle documents when stock is added.
 *
 * Physical bottles are tracked individually so partial bottles can be reused
 * before sealed ones are opened, reducing waste. Each bottle gets a back-reference
 * to the restock transaction for full traceability.
 *
 * quantity here = number of bottle units being restocked (not volume).
 */
const createBottlesOnRestock = async (itemId, quantity, nominalCapacity, restockTxnId) => {
  const item = await InventoryItem.findById(itemId);
  if (!item) throw new Error('Item not found');

  const bottleDocs = Array.from({ length: quantity }, () => ({
    itemId,
    sku:              item.sku,
    status:           INVENTORY.BOTTLE_STATUSES.SEALED,
    fillLevel:        INVENTORY.BOTTLE_FILL_LEVELS.FULL,
    nominalCapacity,
    createdByRestock: String(restockTxnId),
  }));

  const bottles = await Bottle.insertMany(bottleDocs);
  return bottles;
};

module.exports = {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  softDeleteItem,
  adjustStock,
  getLowStockItems,
  getItemTransactions,
  createBottlesOnRestock,
};
