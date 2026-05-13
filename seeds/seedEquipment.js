'use strict';
const Equipment = require('../models/Equipment');

const EQUIPMENT_DEFS = [
  { name: 'Vacuum cleaner',                startTag: 'EQ-001', qty: 3 },
  { name: 'Industrial wet and dry vacuum',  startTag: 'EQ-004', qty: 2 },
  { name: 'Floor scrubbing machine',        startTag: 'EQ-006', qty: 2 },
  { name: 'High-speed polishing machine',   startTag: 'EQ-008', qty: 1 },
  { name: 'Cutting and polishing machine',  startTag: 'EQ-009', qty: 1 },
  { name: 'Carpet shampoo vacuum machine',  startTag: 'EQ-010', qty: 2 },
  { name: 'Steam cleaner machine',          startTag: 'EQ-012', qty: 2 },
  { name: 'Upholstery vacuum cleaner',      startTag: 'EQ-014', qty: 2 },
  { name: 'Washing machine',                startTag: 'EQ-016', qty: 2 },
  { name: 'Pressure washer',                startTag: 'EQ-018', qty: 1 },
  { name: 'Mop and bucket set',             startTag: 'EQ-019', qty: 5 },
  { name: 'Heavy-duty mop and bucket set',  startTag: 'EQ-024', qty: 3 },
  { name: 'Soft-bristle mop',               startTag: 'EQ-027', qty: 2 },
  { name: 'Extendable duster',              startTag: 'EQ-029', qty: 4 },
  { name: 'Duster',                         startTag: 'EQ-033', qty: 4 },
  { name: 'Step ladder',                    startTag: 'EQ-037', qty: 3 },
  { name: 'A-frame ladder',                 startTag: 'EQ-040', qty: 2 },
  { name: 'Extension ladder',               startTag: 'EQ-042', qty: 1 },
  { name: 'Grout brush',                    startTag: 'EQ-043', qty: 4 },
  { name: 'Soft brush attachment',          startTag: 'EQ-047', qty: 3 },
  { name: 'Scrub brush',                    startTag: 'EQ-050', qty: 4 },
  { name: 'Electric hand buffer',           startTag: 'EQ-054', qty: 2 },
  { name: 'High-speed polisher',            startTag: 'EQ-056', qty: 1 },
  { name: 'Professional steam iron',        startTag: 'EQ-057', qty: 3 },
  { name: 'Ironing board',                  startTag: 'EQ-060', qty: 3 },
  { name: 'Garment steamer',                startTag: 'EQ-063', qty: 2 },
  { name: 'Spray bottle set',               startTag: 'EQ-065', qty: 6 },
  { name: 'Pump-up pressure sprayer',       startTag: 'EQ-071', qty: 3 },
  { name: 'Cleaning trolley',          startTag: 'EQ-074', qty: 3 },
  { name: 'Protective goggles',         startTag: 'EQ-077', qty: 4 },
];

/**
 * Parses the numeric suffix from an asset tag like 'EQ-001' → 1.
 */
function parseTagNumber(tag) {
  return parseInt(tag.split('-')[1], 10);
}

/**
 * Formats a numeric tag index back to zero-padded 3-digit string.
 */
function formatTag(num) {
  return `EQ-${String(num).padStart(3, '0')}`;
}

module.exports = async function seedEquipment() {
  await Equipment.deleteMany({});

  const docs = [];
  for (const def of EQUIPMENT_DEFS) {
    const start = parseTagNumber(def.startTag);
    for (let i = 0; i < def.qty; i++) {
      docs.push({ name: def.name, assetTag: formatTag(start + i), status: 'available' });
    }
  }

  const equipmentItems = await Equipment.insertMany(docs);

  return { equipmentItems };
};
