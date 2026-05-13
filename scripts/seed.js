/**
 * Seed script — run once to bootstrap the database.
 * Usage: node scripts/seed.js
 *
 * Creates:
 *   - 1 main admin account
 *   - 1 test customer account (verified)
 *   - 1 test staff account (must change password)
 *   - 5 sample inventory items
 *   - Sample sealed Bottle documents for consumable items
 *
 * NOTE: Consumption rates are seeded separately via node seeds/index.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose       = require('mongoose');
const User           = require('../models/User');
const InventoryItem  = require('../models/InventoryItem');
const Bottle         = require('../models/Bottle');
const INVENTORY      = require('../constants/inventory');

const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@cloudlaundry.lk';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234';
const ADMIN_NAME     = process.env.SEED_ADMIN_NAME     || 'System Administrator';

const SAMPLE_INVENTORY = [
  { name: 'Detergent Powder',    sku: 'DET-001', type: 'consumable', unit: 'kg',     quantity: 50, costPerUnit: 850,   lowStockThreshold: 10, supplier: { name: 'CleanCo Supplies', contact: '+94 11 234 5678' } },
  { name: 'Fabric Softener',     sku: 'FAB-001', type: 'consumable', unit: 'litres', quantity: 30, costPerUnit: 650,   lowStockThreshold: 8  },
  { name: 'Starch Spray',        sku: 'STA-001', type: 'consumable', unit: 'pcs',    quantity: 24, costPerUnit: 450,   lowStockThreshold: 5  },
  { name: 'Washing Machine 7kg', sku: 'WM-001',  type: 'equipment',  unit: 'units',  quantity: 3,  costPerUnit: 85000, lowStockThreshold: 1  },
  { name: 'Steam Iron',          sku: 'IRN-001', type: 'equipment',  unit: 'units',  quantity: 6,  costPerUnit: 12000, lowStockThreshold: 2  },
];

// Sample bottle counts per consumable SKU
const SAMPLE_BOTTLES = [
  { sku: 'DET-001', count: 10, nominalCapacity: 5 },
  { sku: 'FAB-001', count: 6,  nominalCapacity: 5 },
  { sku: 'STA-001', count: 24, nominalCapacity: 1 },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB:', process.env.MONGO_URI);

    // ── Admin user ──────────────────────────────────────────────────────
    let adminUser;
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    if (existingAdmin) {
      console.log(`Admin already exists: ${ADMIN_EMAIL}`);
      adminUser = existingAdmin;
    } else {
      adminUser = await User.create({
        name:       ADMIN_NAME,
        email:      ADMIN_EMAIL,
        password:   ADMIN_PASSWORD,
        role:       'admin',
        isVerified: true,
        isActive:   true,
      });
      console.log(`✔ Admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    }

    // ── Test customer ───────────────────────────────────────────────────
    const custEmail = 'customer@cloudlaundry.lk';
    const existingCust = await User.findOne({ email: custEmail });
    if (!existingCust) {
      await User.create({
        name:       'Test Customer',
        email:      custEmail,
        password:   'Customer@1234',
        role:       'customer',
        isVerified: true,
      });
      console.log(`✔ Test customer: ${custEmail} / Customer@1234`);
    }

    // ── Test staff ──────────────────────────────────────────────────────
    const staffEmail = 'staff@cloudlaundry.lk';
    const existingStaff = await User.findOne({ email: staffEmail });
    if (!existingStaff) {
      await User.create({
        name:               'Test Staff',
        email:              staffEmail,
        password:           'Staff@1234',
        role:               'employee',
        isVerified:         true,
        mustChangePassword: true,
      });
      console.log(`✔ Test staff: ${staffEmail} / Staff@1234 (must change password)`);
    }

    // ── Inventory items ─────────────────────────────────────────────────
    const skuToId = {};
    for (const item of SAMPLE_INVENTORY) {
      const exists = await InventoryItem.findOne({ sku: item.sku });
      if (!exists) {
        const created = await InventoryItem.create(item);
        skuToId[item.sku] = created._id;
        console.log(`✔ Inventory: ${item.name}`);
      } else {
        skuToId[item.sku] = exists._id;
      }
    }

    // ── Consumption rates ───────────────────────────────────────────────
    // Skipped here — seeded separately with the correct schema.
    // Run: node seeds/index.js
    console.log('  Consumption rates skipped — run: node seeds/index.js');

    // ── Sample bottles for consumable items ─────────────────────────────
    let bottlesInserted = 0;
    for (const { sku, count, nominalCapacity } of SAMPLE_BOTTLES) {
      const itemId = skuToId[sku];
      if (!itemId) continue;

      const existingCount = await Bottle.countDocuments({ itemId });
      if (existingCount > 0) continue;

      const bottleDocs = Array.from({ length: count }, () => ({
        itemId,
        sku,
        status:           INVENTORY.BOTTLE_STATUSES.SEALED,
        fillLevel:        INVENTORY.BOTTLE_FILL_LEVELS.FULL,
        nominalCapacity,
        createdByRestock: 'seed',
      }));

      await Bottle.insertMany(bottleDocs);
      bottlesInserted += count;
      console.log(`✔ Bottles: ${count} sealed bottles for ${sku}`);
    }

    if (bottlesInserted === 0) {
      console.log('  Sample bottles already seeded — skipped');
    }

    console.log('\n✅ Seed complete.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seed();