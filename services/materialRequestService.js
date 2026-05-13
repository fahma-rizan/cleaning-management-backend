const mongoose = require('mongoose');
const Booking         = require('../models/Booking');
const InventoryItem   = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const ConsumptionRate = require('../models/ConsumptionRate');
const MaterialRequest = require('../models/MaterialRequest');
const Equipment       = require('../models/Equipment');
const INVENTORY       = require('../constants/inventory');

// Imported lazily inside functions that call it to avoid circular dependency
// (lowStockAlertService → inventoryService → materialRequestService)
const getLowStockAlertService = () => require('./lowStockAlertService');

/**
 * calculateMaterialNeeds — generates the MaterialRequest for a booking.
 *
 * Called right after a booking is created so admin review can begin immediately.
 * Quantities for non-flat-rate items use ceil() so we never under-allocate.
 */
const calculateMaterialNeeds = async (bookingId) => {
  const booking = await Booking.findById(bookingId).populate('customerId', 'name');
  if (!booking) throw new Error('Booking not found');

  const rate = await ConsumptionRate.findOne({
    serviceType: booking.serviceType,
    subType:     booking.subType,
  });

  if (!rate) throw new Error('No consumption rate found for this service type and subType');

  const consumables = [];
  const equipment   = [];

  for (const rateItem of rate.items) {
    if (rateItem.itemType === 'consumable') {
      const item = await InventoryItem.findById(rateItem.itemId);
      if (!item) continue;
      const allocated = rateItem.flatPerJob
        ? rateItem.ratePerUnit
        : Math.ceil(rateItem.ratePerUnit * booking.usageFactorValue);
      consumables.push({
        itemId:     item._id,
        name:       item.name,
        sku:        item.sku,
        unit:       item.unit,
        allocated,
        available:  item.quantity,
        sufficient: item.quantity >= allocated,
      });
    } else if (rateItem.itemType === 'equipment') {
      const item = await Equipment.findById(rateItem.itemId);
      if (!item) continue;
      const available = item.status === 'available' ? 1 : 0;
      equipment.push({
        itemId:     item._id,
        name:       item.name,
        needed:     1,
        available,
        sufficient: item.status === 'available',
      });
    }
  }

  const items = [
    ...consumables.map((c) => ({
      itemId:       c.itemId,
      itemType:     'consumable',
      requestedQty: c.allocated,
      allocatedQty: 0,
    })),
    ...equipment.map((e) => ({
      itemId:       e.itemId,
      itemType:     'equipment',
      requestedQty: e.needed,
      allocatedQty: 0,
    })),
  ];

  const materialRequest = await MaterialRequest.create({
    bookingId: booking._id,
    status:    'pending',
    items,
  });

  await Booking.findByIdAndUpdate(bookingId, {
    materialStatus:    'pending_materials',
    materialRequestId: materialRequest._id,
  });

  return materialRequest;
};

/**
 * approveMaterialRequest — atomically checks stock, deducts consumables,
 * and reserves equipment units.
 *
 * Uses session.withTransaction so any failure rolls back all changes rather
 * than leaving stock partially deducted.
 */
const approveMaterialRequest = async (requestId, adminUserId) => {
  const session = await mongoose.startSession();

  let updatedRequest;

  await session.withTransaction(async () => {
    const request = await MaterialRequest.findById(requestId).session(session);
    if (!request) throw new Error('Material request not found');
    if (request.status !== INVENTORY.MATERIAL_REQUEST_STATUSES.PENDING_REVIEW) {
      throw new Error(`Request is already ${request.status}`);
    }

    const now = new Date();

    // ── Consumables: stock check → deduction ──────────────────────────────
    const consumableItems = request.items.filter((i) => i.itemType === 'consumable');
    for (const line of consumableItems) {
      const item = await InventoryItem.findOne(
        { _id: line.itemId, isActive: true }
      ).session(session);

      if (!item) throw new Error('Item not found: ' + line.itemId);
      if (item.quantity < line.requestedQty) {
        throw new Error(
          'Insufficient stock for ' + item.name +
          '. Need ' + line.requestedQty + ' ' + item.unit +
          ', have ' + item.quantity
        );
      }

      const quantityBefore = item.quantity;
      item.quantity -= line.requestedQty;
      line.allocatedQty = line.requestedQty;
      await item.save({ session });

      await InventoryTransaction.create(
        [{
          itemId:         item._id,
          type:           INVENTORY.TRANSACTION_TYPES.MATERIAL_DEDUCTION,
          quantity:       line.requestedQty,
          quantityBefore,
          quantityAfter:  item.quantity,
          costPerUnit:    item.costPerUnit,
          notes:          'Material deduction for booking ' + request.bookingId,
          performedBy:    adminUserId,
        }],
        { session }
      );
    }

    // ── Equipment: mark unit in_use ───────────────────────────────────────
    const equipmentItems = request.items.filter((i) => i.itemType === 'equipment');
    for (const line of equipmentItems) {
      const item = await Equipment.findOne({ _id: line.itemId }).session(session);

      if (!item) throw new Error('Equipment not found: ' + line.itemId);
      if (item.status !== 'available') {
        throw new Error('Equipment not available: ' + item.name);
      }

      item.status     = 'in_use';
      item.assignedTo = request.bookingId;
      line.allocatedQty = 1;
      await item.save({ session });
    }

    // ── Finalise request and booking ──────────────────────────────────────
    request.status     = INVENTORY.MATERIAL_REQUEST_STATUSES.APPROVED;
    request.reviewedBy = adminUserId;
    request.reviewedAt = now;
    request.markModified('items');
    await request.save({ session });

    await Booking.findByIdAndUpdate(
      request.bookingId,
      { materialStatus: 'materials_approved' },
      { session }
    );

    updatedRequest = request;
  });

  session.endSession();

  // Post-transaction: check low-stock alerts (non-atomic, best-effort)
  const lowStockAlertService = getLowStockAlertService();
  const consumables = updatedRequest.items.filter((i) => i.itemType === 'consumable');
  for (const line of consumables) {
    await lowStockAlertService.checkAndCreateLowStockAlert(line.itemId).catch(() => {});
  }

  return updatedRequest;
};

/**
 * rejectMaterialRequest — admin declines a request with a mandatory reason.
 *
 * Booking status reverts to materials_rejected so the workflow is clearly blocked
 * rather than silently stuck.
 */
const rejectMaterialRequest = async (requestId, adminUserId, reason) => {
  if (!reason || !reason.trim()) throw new Error('Rejection reason is required');

  const request = await MaterialRequest.findById(requestId);
  if (!request) throw new Error('Material request not found');
  if (request.status !== INVENTORY.MATERIAL_REQUEST_STATUSES.PENDING_REVIEW) {
    throw new Error(`Request is already ${request.status}`);
  }

  request.status          = INVENTORY.MATERIAL_REQUEST_STATUSES.REJECTED;
  request.rejectionReason = reason.trim();
  request.reviewedBy      = adminUserId;
  request.reviewedAt      = new Date();
  await request.save();

  await Booking.findByIdAndUpdate(request.bookingId, { materialStatus: 'materials_rejected' });

  return request;
};

/**
 * getMaterialRequests — paginated list with booking context and item details.
 *
 * items[].itemId has ref: 'InventoryItem' in the schema, but equipment rows
 * store Equipment _ids. Mongoose populate therefore silently returns null for
 * equipment items. We avoid the problem entirely by fetching item data in two
 * bulk queries (one per collection) after the main find, then merging the
 * results in memory. This is also faster than per-item populate calls.
 */
const getMaterialRequests = async ({ status, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    MaterialRequest.find(filter)
      .populate({
        path: 'bookingId',
        select: 'bookingRef serviceType subType scheduledDate usageFactor usageFactorValue customerId',
        populate: { path: 'customerId', select: 'name email' },
      })
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MaterialRequest.countDocuments(filter),
  ]);

  // Collect unique IDs per collection for bulk lookup
  const consumableIds = new Set();
  const equipmentIds  = new Set();
  for (const req of docs) {
    for (const item of req.items || []) {
      const id = item.itemId?.toString();
      if (!id) continue;
      if (item.itemType === 'consumable') consumableIds.add(id);
      else if (item.itemType === 'equipment') equipmentIds.add(id);
    }
  }

  const [invMap, eqMap] = await Promise.all([
    consumableIds.size > 0
      ? InventoryItem.find({ _id: { $in: [...consumableIds] } })
          .select('name sku unit quantity').lean()
          .then(list => Object.fromEntries(list.map(d => [d._id.toString(), d])))
      : Promise.resolve({}),
    equipmentIds.size > 0
      ? Equipment.find({ _id: { $in: [...equipmentIds] } })
          .select('name assetTag status').lean()
          .then(list => Object.fromEntries(list.map(d => [d._id.toString(), d])))
      : Promise.resolve({}),
  ]);

  const requests = docs.map(req => ({
    ...req,
    items: (req.items || []).map(item => {
      const id = item.itemId?.toString();
      if (item.itemType === 'consumable') {
        const inv = invMap[id];
        return {
          ...item,
          name:       inv?.name     ?? '—',
          sku:        inv?.sku      ?? '—',
          unit:       inv?.unit     ?? '',
          inStock:    inv?.quantity ?? null,
          sufficient: inv != null ? inv.quantity >= item.requestedQty : null,
        };
      }
      const eq = eqMap[id];
      return {
        ...item,
        name:       eq?.name     ?? '—',
        sku:        eq?.assetTag ?? '—',
        unit:       'unit',
        inStock:    null,
        sufficient: eq != null ? eq.status === 'available' : null,
      };
    }),
  }));

  return {
    requests,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

/**
 * getMaterialRequestByBooking — fetches the single request associated with a booking.
 */
const getMaterialRequestByBooking = async (bookingId) => {
  const request = await MaterialRequest.findOne({ bookingId })
    .populate('bookingId', 'bookingRef serviceType scheduledDate roomCount')
    .populate('reviewedBy', 'name email')
    .populate('assignedBottles');

  if (!request) throw new Error('No material request found for this booking');
  return request;
};

module.exports = {
  calculateMaterialNeeds,
  approveMaterialRequest,
  rejectMaterialRequest,
  getMaterialRequests,
  getMaterialRequestByBooking,
};
