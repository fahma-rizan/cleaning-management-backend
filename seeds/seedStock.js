'use strict';
const InventoryItem = require('../models/InventoryItem');

const RAW_ITEMS = [
  { name: 'All-purpose cleaner',                  unit: 'litres',  lowStockThreshold: 5  },
  { name: 'Floor cleaner',                         unit: 'litres',  lowStockThreshold: 5  },
  { name: 'Bathroom / toilet cleaner',             unit: 'litres',  lowStockThreshold: 3  },
  { name: 'Kitchen degreaser',                     unit: 'litres',  lowStockThreshold: 3  },
  { name: 'Glass cleaner',                         unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Cabinet and drawer cleaner',            unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Stain remover solution',                unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Construction / cement dust remover',    unit: 'litres',  lowStockThreshold: 3  },
  { name: 'Paint mark remover',                    unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Tile and grout cleaner',                unit: 'litres',  lowStockThreshold: 3  },
  { name: 'Surface polish',                        unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Marble-safe cleaning solution',         unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Marble polishing compound',             unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Marble sealer',                         unit: 'litres',  lowStockThreshold: 1  },
  { name: 'Wood-safe cleaning solution',           unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Wood polish / wax',                     unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Grout cleaner',                         unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Degreaser',                             unit: 'litres',  lowStockThreshold: 2  },
  { name: 'High-speed polishing compound',         unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Crystallization chemical',              unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Floor scrubbing solution',              unit: 'litres',  lowStockThreshold: 5  },
  { name: 'Restroom sanitizer',                    unit: 'litres',  lowStockThreshold: 3  },
  { name: 'Paint stain remover',                   unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Glass and window cleaner (heavy duty)', unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Tile cleaner solution',                 unit: 'litres',  lowStockThreshold: 3  },
  { name: 'Upholstery shampoo solution',           unit: 'litres',  lowStockThreshold: 3  },
  { name: 'Stain remover spray',                   unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Odor eliminator / deodorizer',          unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Upholstery sanitizer spray',            unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Allergen treatment solution',           unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Carpet shampoo solution',               unit: 'litres',  lowStockThreshold: 3  },
  { name: 'Stain treatment spray',                 unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Carpet deodorizer',                     unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Dry cleaning solvent',                  unit: 'litres',  lowStockThreshold: 3  },
  { name: 'Stain remover (dry-safe)',              unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Laundry detergent',                     unit: 'litres',  lowStockThreshold: 3  },
  { name: 'Fabric softener',                       unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Gentle fabric-safe cleaning solution',  unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Specialty stain treatment solution',    unit: 'litres',  lowStockThreshold: 2  },
  { name: 'Microfiber cloths',                     unit: 'pieces',  lowStockThreshold: 50 },
  { name: 'Soft microfiber cloths',                unit: 'pieces',  lowStockThreshold: 20 },
  { name: 'Scrub pads',                            unit: 'pieces',  lowStockThreshold: 30 },
  { name: 'Heavy-duty scrub pads',                 unit: 'pieces',  lowStockThreshold: 20 },
  { name: 'Garbage bags',                          unit: 'pieces',  lowStockThreshold: 50 },
  { name: 'Gloves (disposable)',                   unit: 'pairs',   lowStockThreshold: 30 },
  { name: 'Protective dust mask',                  unit: 'pieces',  lowStockThreshold: 20 },
  { name: 'Protective goggles',                    unit: 'pieces',  lowStockThreshold: 10 },
  { name: 'Heavy-duty scrub brush',                unit: 'pieces',  lowStockThreshold: 10 },
  { name: 'Buffing pads',                          unit: 'pieces',  lowStockThreshold: 10 },
  { name: 'Diamond cutting pads',                  unit: 'pieces',  lowStockThreshold: 5  },
  { name: 'Protective pressing cloth',             unit: 'pieces',  lowStockThreshold: 10 },
];

module.exports = async function seedStock() {
  await InventoryItem.deleteMany({ type: 'consumable' });

  const docs = RAW_ITEMS.map((item, i) => ({
    ...item,
    sku:         `CONS-${String(i + 1).padStart(3, '0')}`,
    type:        'consumable',
    quantity:    0,
    costPerUnit: 0,
  }));

  const stockItems = await InventoryItem.insertMany(docs);
  return { stockItems };
};
