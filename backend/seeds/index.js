'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected.\n');

  console.log('─── Step 1/2: Stock ───────────────────────');
  const { stockItems }       = await require('./seedStock')();
  console.log(`    ✔ ${stockItems.length} stock items inserted\n`);

  console.log('─── Step 2/2: Consumption Rates ───────────');
  const { consumptionRates } = await require('./seedConsumptionRates')({ stockItems });
  console.log(`    ✔ ${consumptionRates.length} consumption rates inserted\n`);

  console.log('══════════════════════════════════════════');
  console.log('Seed complete. Summary:');
  console.log(`  Stock items       : ${stockItems.length}`);
  console.log(`  Consumption rates : ${consumptionRates.length}`);
  console.log('══════════════════════════════════════════');

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
