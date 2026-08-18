const cron           = require('node-cron');
const loyaltyService = require('../services/loyaltyService');

// Runs at midnight on December 31 every year
cron.schedule('0 0 31 11 *', async () => {
  console.log('[LoyaltyCron] Running annual balance reset...');
  try {
    const result = await loyaltyService.resetYearlyBalance();
    console.log(`[LoyaltyCron] Reset complete — ${result.resetCount} accounts cleared`);
  } catch (err) {
    console.error('[LoyaltyCron] Reset failed:', err.message);
  }
});

console.log('[LoyaltyCron] Annual balance reset scheduled (Dec 31 midnight)');
