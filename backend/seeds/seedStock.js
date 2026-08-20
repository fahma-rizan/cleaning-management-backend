'use strict';
const InventoryItem = require('../models/InventoryItem');
const INVENTORY      = require('../constants/inventory');

const T = INVENTORY.CONSUMABLE_TYPES;

// Names below are also referenced by seedConsumptionRates.js's con() lookups —
// keep exact spelling in sync if renaming an item here.
const RAW_ITEMS = [
  // ── Cleaning Chemicals ────────────────────────────────────────────────
  { name: 'All-purpose cleaner',                  type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 60,  lowStockThreshold: 10, costPerUnit: 350 },
  { name: 'Floor cleaner',                        type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 50,  lowStockThreshold: 10, costPerUnit: 200 },
  { name: 'Bathroom / toilet cleaner',             type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 45,  lowStockThreshold: 8,  costPerUnit: 280 },
  { name: 'Kitchen degreaser',                     type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 35,  lowStockThreshold: 6,  costPerUnit: 420 },
  { name: 'Cabinet and drawer cleaner',            type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 20,  lowStockThreshold: 5,  costPerUnit: 380 },
  { name: 'Stain remover solution',                type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 25,  lowStockThreshold: 5,  costPerUnit: 450 },
  { name: 'Construction / cement dust remover',    type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 30,  lowStockThreshold: 6,  costPerUnit: 500 },
  { name: 'Paint mark remover',                    type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 18,  lowStockThreshold: 4,  costPerUnit: 480 },
  { name: 'Tile and grout cleaner',                type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 32,  lowStockThreshold: 6,  costPerUnit: 320 },
  { name: 'Grout cleaner',                         type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 22,  lowStockThreshold: 5,  costPerUnit: 340 },
  { name: 'Degreaser',                             type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 28,  lowStockThreshold: 6,  costPerUnit: 400 },
  { name: 'Floor scrubbing solution',              type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 40,  lowStockThreshold: 10, costPerUnit: 300 },
  { name: 'Paint stain remover',                   type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 16,  lowStockThreshold: 4,  costPerUnit: 460 },
  { name: 'Tile cleaner solution',                 type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 30,  lowStockThreshold: 6,  costPerUnit: 310 },
  { name: 'Dry cleaning solvent',                  type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 20,  lowStockThreshold: 5,  costPerUnit: 900 },
  { name: 'Stain remover (dry-safe)',              type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 12,  lowStockThreshold: 3,  costPerUnit: 520 },
  { name: 'Laundry detergent',                     type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 55,  lowStockThreshold: 10, costPerUnit: 380 },
  { name: 'Fabric softener',                       type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 40,  lowStockThreshold: 8,  costPerUnit: 350 },
  { name: 'Gentle fabric-safe cleaning solution',  type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 18,  lowStockThreshold: 4,  costPerUnit: 470 },
  { name: 'Specialty stain treatment solution',    type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 14,  lowStockThreshold: 3,  costPerUnit: 550 },
  { name: 'Disinfectant',                          type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 45,  lowStockThreshold: 10, costPerUnit: 400 },
  { name: 'Bleach',                                type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 35,  lowStockThreshold: 8,  costPerUnit: 220 },
  { name: 'Multipurpose cleaner',                  type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 50,  lowStockThreshold: 10, costPerUnit: 330 },
  { name: 'Stainless steel cleaner',                type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 15,  lowStockThreshold: 4,  costPerUnit: 490 },
  { name: 'Wood/furniture cleaner',                 type: T.CLEANING_CHEMICALS,        unit: 'litres', quantity: 18,  lowStockThreshold: 4,  costPerUnit: 460 },
  { name: 'Oven cleaner',                          type: T.CLEANING_CHEMICALS,        unit: 'bottles', quantity: 20, lowStockThreshold: 5,  costPerUnit: 550 },
  { name: 'Drain cleaner',                         type: T.CLEANING_CHEMICALS,        unit: 'bottles', quantity: 15, lowStockThreshold: 4,  costPerUnit: 480 },

  // ── Cleaning Supplies ─────────────────────────────────────────────────
  { name: 'Microfiber cloths',                     type: T.CLEANING_SUPPLIES,         unit: 'pieces', quantity: 150, lowStockThreshold: 30, costPerUnit: 90  },
  { name: 'Soft microfiber cloths',                type: T.CLEANING_SUPPLIES,         unit: 'pieces', quantity: 80,  lowStockThreshold: 20, costPerUnit: 110 },
  { name: 'Scrub pads',                            type: T.CLEANING_SUPPLIES,         unit: 'pieces', quantity: 100, lowStockThreshold: 25, costPerUnit: 60  },
  { name: 'Heavy-duty scrub pads',                 type: T.CLEANING_SUPPLIES,         unit: 'pieces', quantity: 60,  lowStockThreshold: 15, costPerUnit: 85  },
  { name: 'Heavy-duty scrub brush',                type: T.CLEANING_SUPPLIES,         unit: 'pieces', quantity: 25,  lowStockThreshold: 8,  costPerUnit: 220 },
  { name: 'Protective pressing cloth',             type: T.CLEANING_SUPPLIES,         unit: 'pieces', quantity: 30,  lowStockThreshold: 8,  costPerUnit: 150 },
  { name: 'Steel wool',                            type: T.CLEANING_SUPPLIES,         unit: 'pieces', quantity: 40,  lowStockThreshold: 10, costPerUnit: 70  },
  { name: 'Cleaning wipes',                        type: T.CLEANING_SUPPLIES,         unit: 'packs',  quantity: 70,  lowStockThreshold: 15, costPerUnit: 320 },
  { name: 'Disposable cleaning cloth',             type: T.CLEANING_SUPPLIES,         unit: 'pieces', quantity: 200, lowStockThreshold: 40, costPerUnit: 25  },
  { name: 'Mop head',                              type: T.CLEANING_SUPPLIES,         unit: 'pieces', quantity: 35,  lowStockThreshold: 8,  costPerUnit: 480 },
  { name: 'Disposable duster',                     type: T.CLEANING_SUPPLIES,         unit: 'pieces', quantity: 60,  lowStockThreshold: 15, costPerUnit: 65  },

  // ── Waste Management ──────────────────────────────────────────────────
  { name: 'Garbage bags',                          type: T.WASTE_MANAGEMENT,          unit: 'pieces', quantity: 300, lowStockThreshold: 60, costPerUnit: 15  },
  { name: 'Bin liners',                            type: T.WASTE_MANAGEMENT,          unit: 'pieces', quantity: 250, lowStockThreshold: 50, costPerUnit: 12  },
  { name: 'Heavy-duty garbage bags',                type: T.WASTE_MANAGEMENT,          unit: 'pieces', quantity: 120, lowStockThreshold: 30, costPerUnit: 35  },
  { name: 'Waste disposal bags',                   type: T.WASTE_MANAGEMENT,          unit: 'pieces', quantity: 150, lowStockThreshold: 30, costPerUnit: 20  },

  // ── PPE & Safety ──────────────────────────────────────────────────────
  { name: 'Gloves (disposable)',                   type: T.PPE_SAFETY,                unit: 'pairs',  quantity: 200, lowStockThreshold: 40, costPerUnit: 30  },
  { name: 'Nitrile gloves',                        type: T.PPE_SAFETY,                unit: 'pairs',  quantity: 150, lowStockThreshold: 30, costPerUnit: 45  },
  { name: 'Latex gloves',                          type: T.PPE_SAFETY,                unit: 'pairs',  quantity: 120, lowStockThreshold: 30, costPerUnit: 35  },
  { name: 'Face masks',                            type: T.PPE_SAFETY,                unit: 'boxes',  quantity: 40,  lowStockThreshold: 10, costPerUnit: 650 },
  { name: 'Protective dust mask',                  type: T.PPE_SAFETY,                unit: 'pieces', quantity: 80,  lowStockThreshold: 20, costPerUnit: 55  },
  { name: 'Protective goggles',                    type: T.PPE_SAFETY,                unit: 'pieces', quantity: 25,  lowStockThreshold: 8,  costPerUnit: 320 },
  { name: 'Disposable shoe covers',                type: T.PPE_SAFETY,                unit: 'pairs',  quantity: 100, lowStockThreshold: 20, costPerUnit: 20  },
  { name: 'Disposable aprons',                     type: T.PPE_SAFETY,                unit: 'pieces', quantity: 60,  lowStockThreshold: 15, costPerUnit: 90  },
  { name: 'Hair covers',                           type: T.PPE_SAFETY,                unit: 'pieces', quantity: 150, lowStockThreshold: 30, costPerUnit: 10  },

  // ── Floor & Surface Treatment ─────────────────────────────────────────
  { name: 'Surface polish',                        type: T.FLOOR_SURFACE_TREATMENT,   unit: 'litres', quantity: 20,  lowStockThreshold: 5,  costPerUnit: 600 },
  { name: 'Marble-safe cleaning solution',         type: T.FLOOR_SURFACE_TREATMENT,   unit: 'litres', quantity: 15,  lowStockThreshold: 4,  costPerUnit: 700 },
  { name: 'Marble polishing compound',             type: T.FLOOR_SURFACE_TREATMENT,   unit: 'litres', quantity: 10,  lowStockThreshold: 3,  costPerUnit: 850 },
  { name: 'Marble sealer',                         type: T.FLOOR_SURFACE_TREATMENT,   unit: 'litres', quantity: 8,   lowStockThreshold: 2,  costPerUnit: 950 },
  { name: 'Wood-safe cleaning solution',           type: T.FLOOR_SURFACE_TREATMENT,   unit: 'litres', quantity: 14,  lowStockThreshold: 4,  costPerUnit: 620 },
  { name: 'Wood polish / wax',                     type: T.FLOOR_SURFACE_TREATMENT,   unit: 'litres', quantity: 12,  lowStockThreshold: 3,  costPerUnit: 680 },
  { name: 'High-speed polishing compound',         type: T.FLOOR_SURFACE_TREATMENT,   unit: 'litres', quantity: 10,  lowStockThreshold: 3,  costPerUnit: 900 },
  { name: 'Crystallization chemical',              type: T.FLOOR_SURFACE_TREATMENT,   unit: 'litres', quantity: 8,   lowStockThreshold: 2,  costPerUnit: 1100},
  { name: 'Buffing pads',                          type: T.FLOOR_SURFACE_TREATMENT,   unit: 'pieces', quantity: 20,  lowStockThreshold: 6,  costPerUnit: 750 },
  { name: 'Diamond cutting pads',                  type: T.FLOOR_SURFACE_TREATMENT,   unit: 'pieces', quantity: 10,  lowStockThreshold: 3,  costPerUnit: 2200},
  { name: 'Floor polish',                          type: T.FLOOR_SURFACE_TREATMENT,   unit: 'litres', quantity: 22,  lowStockThreshold: 5,  costPerUnit: 480 },
  { name: 'Floor wax',                             type: T.FLOOR_SURFACE_TREATMENT,   unit: 'litres', quantity: 16,  lowStockThreshold: 4,  costPerUnit: 520 },
  { name: 'Polishing pads',                        type: T.FLOOR_SURFACE_TREATMENT,   unit: 'pieces', quantity: 18,  lowStockThreshold: 5,  costPerUnit: 680 },
  { name: 'Surface sealant',                       type: T.FLOOR_SURFACE_TREATMENT,   unit: 'litres', quantity: 9,   lowStockThreshold: 2,  costPerUnit: 980 },

  // ── Window Cleaning ───────────────────────────────────────────────────
  { name: 'Glass cleaner',                         type: T.WINDOW_CLEANING,           unit: 'litres', quantity: 48,  lowStockThreshold: 10, costPerUnit: 260 },
  { name: 'Glass and window cleaner (heavy duty)', type: T.WINDOW_CLEANING,           unit: 'litres', quantity: 24,  lowStockThreshold: 6,  costPerUnit: 340 },
  { name: 'Window cleaning solution',              type: T.WINDOW_CLEANING,           unit: 'litres', quantity: 30,  lowStockThreshold: 6,  costPerUnit: 300 },
  { name: 'Glass cleaning detergent',              type: T.WINDOW_CLEANING,           unit: 'litres', quantity: 20,  lowStockThreshold: 5,  costPerUnit: 320 },
  { name: 'Squeegee replacement rubber',           type: T.WINDOW_CLEANING,           unit: 'pieces', quantity: 25,  lowStockThreshold: 8,  costPerUnit: 180 },
  { name: 'Window cleaning sleeve',                type: T.WINDOW_CLEANING,           unit: 'pieces', quantity: 20,  lowStockThreshold: 6,  costPerUnit: 350 },
  { name: 'Scraper blades',                        type: T.WINDOW_CLEANING,           unit: 'packs',  quantity: 15,  lowStockThreshold: 4,  costPerUnit: 250 },

  // ── Sofa & Upholstery Cleaning ────────────────────────────────────────
  { name: 'Upholstery shampoo solution',           type: T.SOFA_UPHOLSTERY_CLEANING,  unit: 'litres', quantity: 20,  lowStockThreshold: 5,  costPerUnit: 750 },
  { name: 'Stain remover spray',                   type: T.SOFA_UPHOLSTERY_CLEANING,  unit: 'bottles', quantity: 25, lowStockThreshold: 6,  costPerUnit: 420 },
  { name: 'Upholstery sanitizer spray',            type: T.SOFA_UPHOLSTERY_CLEANING,  unit: 'bottles', quantity: 20, lowStockThreshold: 5,  costPerUnit: 460 },
  { name: 'Allergen treatment solution',           type: T.SOFA_UPHOLSTERY_CLEANING,  unit: 'litres', quantity: 12,  lowStockThreshold: 3,  costPerUnit: 820 },
  { name: 'Carpet shampoo solution',               type: T.SOFA_UPHOLSTERY_CLEANING,  unit: 'litres', quantity: 18,  lowStockThreshold: 5,  costPerUnit: 700 },
  { name: 'Stain treatment spray',                 type: T.SOFA_UPHOLSTERY_CLEANING,  unit: 'bottles', quantity: 22, lowStockThreshold: 5,  costPerUnit: 400 },
  { name: 'Carpet deodorizer',                     type: T.SOFA_UPHOLSTERY_CLEANING,  unit: 'bottles', quantity: 18, lowStockThreshold: 5,  costPerUnit: 380 },
  { name: 'Upholstery shampoo',                    type: T.SOFA_UPHOLSTERY_CLEANING,  unit: 'litres', quantity: 15,  lowStockThreshold: 4,  costPerUnit: 780 },
  { name: 'Fabric cleaner',                        type: T.SOFA_UPHOLSTERY_CLEANING,  unit: 'litres', quantity: 20,  lowStockThreshold: 5,  costPerUnit: 620 },
  { name: 'Carpet detergent',                      type: T.SOFA_UPHOLSTERY_CLEANING,  unit: 'litres', quantity: 16,  lowStockThreshold: 4,  costPerUnit: 640 },
  { name: 'Fabric sanitizer',                      type: T.SOFA_UPHOLSTERY_CLEANING,  unit: 'litres', quantity: 14,  lowStockThreshold: 4,  costPerUnit: 590 },

  // ── Deodorizing & Sanitizing ──────────────────────────────────────────
  { name: 'Odor eliminator / deodorizer',          type: T.DEODORIZING_SANITIZING,    unit: 'bottles', quantity: 25, lowStockThreshold: 6,  costPerUnit: 380 },
  { name: 'Restroom sanitizer',                    type: T.DEODORIZING_SANITIZING,    unit: 'litres',  quantity: 30, lowStockThreshold: 8,  costPerUnit: 340 },
  { name: 'Air freshener',                         type: T.DEODORIZING_SANITIZING,    unit: 'bottles', quantity: 40, lowStockThreshold: 10, costPerUnit: 260 },
  { name: 'Disinfectant spray',                    type: T.DEODORIZING_SANITIZING,    unit: 'bottles', quantity: 35, lowStockThreshold: 8,  costPerUnit: 320 },
  { name: 'Sanitizing solution',                   type: T.DEODORIZING_SANITIZING,    unit: 'litres',  quantity: 28, lowStockThreshold: 6,  costPerUnit: 350 },
  { name: 'Deodorizing tablets',                   type: T.DEODORIZING_SANITIZING,    unit: 'packs',   quantity: 20, lowStockThreshold: 5,  costPerUnit: 420 },
];

module.exports = async function seedStock() {
  await InventoryItem.deleteMany({ type: { $in: Object.values(T) } });

  const docs = RAW_ITEMS.map((item, i) => ({
    ...item,
    sku: `CONS-${String(i + 1).padStart(3, '0')}`,
  }));

  const stockItems = await InventoryItem.insertMany(docs);
  return { stockItems };
};
