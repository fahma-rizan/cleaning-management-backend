/**
 * ⚠️ DO NOT RUN — BLOCKED pending a team decision on equipment inventory.
 *
 * This script deletes InventoryItem documents and drops the `equipment`
 * collection. The shared Atlas database still has live equipment-typed
 * InventoryItem documents (e.g. EQ-015, IRN-001) and a reserved `equipment`
 * collection, so running this against that database would destroy real,
 * shared teammate data — not just local/test data.
 *
 * It is only safe to run once the team has explicitly decided whether
 * equipment inventory is being removed from the shared schema. Until then,
 * treat this file as inert: do not execute it, and do not wire it into any
 * npm script, cron job, or deploy step.
 *
 * ── Original description (logic unchanged) ──────────────────────────────
 * One-time migration: strips equipment out of the inventory system.
 *
 * - Deletes InventoryItem docs whose `type` isn't one of the new
 *   CONSUMABLE_TYPES categories (covers legacy `type: "consumable"` docs and
 *   any `type: "equipment"` docs, e.g. WM-001/IRN-001 from scripts/seed.js).
 * - Drops the standalone `equipment` collection entirely.
 *
 * Run once, then repopulate with: npm run seed:inventory
 * Usage: node scripts/migrateConsumablesOnly.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose  = require('mongoose');
const INVENTORY = require('../constants/inventory');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB:', process.env.MONGO_URI);

  const InventoryItem = require('../models/InventoryItem');
  const validTypes = Object.values(INVENTORY.CONSUMABLE_TYPES);

  const staleItems = await InventoryItem.find({ type: { $nin: validTypes } })
    .select('name sku type')
    .lean();

  if (staleItems.length > 0) {
    console.log(`\nRemoving ${staleItems.length} InventoryItem doc(s) with an obsolete type:`);
    for (const item of staleItems) {
      console.log(`  - ${item.sku} | ${item.name} | type: ${item.type}`);
    }
    await InventoryItem.deleteMany({ type: { $nin: validTypes } });
  } else {
    console.log('\nNo InventoryItem docs with an obsolete type found.');
  }

  const collections = await mongoose.connection.db.listCollections({ name: 'equipment' }).toArray();
  if (collections.length > 0) {
    const count = await mongoose.connection.db.collection('equipment').countDocuments();
    await mongoose.connection.db.collection('equipment').drop();
    console.log(`\nDropped 'equipment' collection (${count} document(s)).`);
  } else {
    console.log("\nNo 'equipment' collection found — nothing to drop.");
  }

  console.log('\nMigration complete. Run `npm run seed:inventory` to repopulate consumables.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
