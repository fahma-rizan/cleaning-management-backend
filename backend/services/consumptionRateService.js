const ConsumptionRate = require('../models/ConsumptionRate');
const InventoryItem   = require('../models/InventoryItem');

/**
 * getRates — list all consumption rates, optionally filtered by serviceType.
 *
 * Populates itemId so the caller gets item name/sku/unit without an extra query.
 */
const getRates = async ({ serviceType } = {}) => {
  const filter = {};
  if (serviceType) filter.serviceType = serviceType;

  return ConsumptionRate.find(filter)
    .populate('itemId', 'name sku unit type')
    .populate('updatedBy', 'name email')
    .sort({ serviceType: 1 });
};

/**
 * getRatesByService — all active rates for a single service type.
 *
 * Used by materialRequestService when building a material request —
 * returns only active rates so disabled ones are silently skipped.
 */
const getRatesByService = async (serviceType) => {
  return ConsumptionRate.find({ serviceType, isActive: true })
    .populate('itemId', 'name sku unit type quantity lowStockThreshold');
};

/**
 * upsertRate — create or update a rate for a serviceType+item pair.
 *
 * findOneAndUpdate with upsert:true means calling this twice is idempotent —
 * no duplicate-rate errors, no extra existence check needed.
 */
const upsertRate = async ({ serviceType, itemId, qtyPerRoom, notes }, adminUserId) => {
  const item = await InventoryItem.findById(itemId);
  if (!item) throw new Error('Inventory item not found');

  const rate = await ConsumptionRate.findOneAndUpdate(
    { serviceType, itemId },
    {
      $set: {
        qtyPerRoom,
        notes,
        isActive:  true,
        updatedBy: adminUserId,
      },
    },
    { upsert: true, new: true, runValidators: true }
  ).populate('itemId', 'name sku unit');

  return rate;
};

/**
 * deleteRate — hard-delete a rate.
 *
 * Soft-delete (isActive: false) is preferred in most places, but rates are
 * configuration data and a hard-delete keeps the collection tidy.
 */
const deleteRate = async (rateId) => {
  const rate = await ConsumptionRate.findByIdAndDelete(rateId);
  if (!rate) throw new Error('Consumption rate not found');
  return rate;
};

/**
 * seedDefaultRates — bootstraps sensible starting rates for all service types.
 *
 * Only inserts rates where none exist for that serviceType+itemId pair so it
 * is safe to call multiple times without overwriting admin customisations.
 * The rates are illustrative starting points calibrated from typical laundry
 * operations; admins should tune them from real usage data.
 */
const seedDefaultRates = async (adminUserId) => {
  // Build a map of SKU → itemId to avoid N queries per rate entry
  const items = await InventoryItem.find({ isActive: { $ne: false } }).select('_id sku name');
  const skuMap = {};
  for (const item of items) {
    skuMap[item.sku] = item._id;
  }

  // Default rates: [serviceType, sku, qtyPerRoom, notes]
  const defaults = [
    // wash_and_fold uses a lot of detergent and some softener per load
    ['wash_and_fold', 'DET-001', 0.05,  'Approx 50g detergent per room load'],
    ['wash_and_fold', 'FAB-001', 0.02,  'Approx 20ml fabric softener per room load'],
    // dry cleaning uses starch spray for finishing
    ['dry_cleaning',  'STA-001', 1,     '1 spray can per cleaning session'],
    // ironing uses starch spray lightly
    ['ironing',       'STA-001', 0.5,   '0.5 spray cans per ironing session'],
    // wash_and_iron combines detergent + softener + starch
    ['wash_and_iron', 'DET-001', 0.05,  'Same detergent rate as wash_and_fold'],
    ['wash_and_iron', 'FAB-001', 0.02,  'Same softener rate as wash_and_fold'],
    ['wash_and_iron', 'STA-001', 0.5,   'Starch for ironing finish'],
    // express_service — same materials, higher throughput so rates hold
    ['express_service','DET-001', 0.05, 'Standard detergent rate'],
    ['express_service','FAB-001', 0.02, 'Standard softener rate'],
    // stain_removal uses starch spray as a pre-treatment stand-in
    ['stain_removal',  'STA-001', 1,   '1 spray per stain treatment'],
    // curtain_cleaning needs extra detergent for heavy fabric
    ['curtain_cleaning','DET-001', 0.08,'Heavier load: 80g detergent per room'],
    ['curtain_cleaning','FAB-001', 0.03,'30ml softener for curtain fabric'],
    // shoe_cleaning is low volume
    ['shoe_cleaning',  'DET-001', 0.01,'10g detergent per pair'],
  ];

  let inserted = 0;
  for (const [serviceType, sku, qtyPerRoom, notes] of defaults) {
    const itemId = skuMap[sku];
    if (!itemId) continue; // item not seeded yet — skip gracefully

    const existing = await ConsumptionRate.findOne({ serviceType, itemId });
    if (existing) continue; // don't overwrite admin-customised rates

    await ConsumptionRate.create({ serviceType, itemId, qtyPerRoom, notes, updatedBy: adminUserId });
    inserted++;
  }

  return { inserted };
};

module.exports = {
  getRates,
  getRatesByService,
  upsertRate,
  deleteRate,
  seedDefaultRates,
};
