const mongoose = require('mongoose');
const Booking         = require('../models/Booking');
const InventoryItem   = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const ConsumptionRate = require('../models/ConsumptionRate');
const MaterialRequest = require('../models/MaterialRequest');
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
    }
  }

  const items = consumables.map((c) => ({
    itemId:       c.itemId,
    itemType:     'consumable',
    requestedQty: c.allocated,
    allocatedQty: 0,
  }));

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
 * approveMaterialRequest — atomically checks stock and deducts consumables.
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
        { _id: line.itemId, isActive: { $ne: false } }
      ).session(session);

      if (!item) throw new Error('Item not found: ' + line.itemId);
      if (item.quantity < line.requestedQty) {
        throw new Error(
          'Insufficient stock for ' + item.name +
          '. Need ' + line.requestedQty + ' ' + item.unit +
          ', have ' + item.quantity
        );
      }

      const previousQty = item.quantity;
      item.quantity -= line.requestedQty;
      line.allocatedQty = line.requestedQty;
      await item.save({ session });

      await InventoryTransaction.create(
        [{
          itemId:      item._id,
          type:        INVENTORY.TRANSACTION_TYPES.MATERIAL_DEDUCTION,
          quantity:    line.requestedQty,
          previousQty,
          newQty:      item.quantity,
          costPerUnit: item.costPerUnit,
          notes:       'Material deduction for booking ' + request.bookingId,
          performedBy: adminUserId,
        }],
        { session }
      );
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
 * Item details are fetched in one bulk query after the main find, then merged
 * in memory — faster than per-item populate calls.
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

  // Collect unique item IDs for bulk lookup
  const consumableIds = new Set();
  for (const req of docs) {
    for (const item of req.items || []) {
      const id = item.itemId?.toString();
      if (id) consumableIds.add(id);
    }
  }

  const invMap = consumableIds.size > 0
    ? await InventoryItem.find({ _id: { $in: [...consumableIds] } })
        .select('name sku unit quantity').lean()
        .then(list => Object.fromEntries(list.map(d => [d._id.toString(), d])))
    : {};

  const requests = docs.map(req => ({
    ...req,
    items: (req.items || []).map(item => {
      const id  = item.itemId?.toString();
      const inv = invMap[id];
      return {
        ...item,
        name:       inv?.name     ?? '—',
        sku:        inv?.sku      ?? '—',
        unit:       inv?.unit     ?? '',
        inStock:    inv?.quantity ?? null,
        sufficient: inv != null ? inv.quantity >= item.requestedQty : null,
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
