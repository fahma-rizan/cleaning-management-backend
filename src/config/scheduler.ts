import cron     from 'node-cron';
import Customer from '../models/Customer';

const runInactiveCheck = async () => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6); 

    const result = await Customer.updateMany(
      { status: 'active', lastBooking: { $lt: sixMonthsAgo } },
      { $set: { status: 'inactive' } }
    );

    console.log(`Scheduler: ${result.modifiedCount} customers set to inactive`);
  } catch (err) {
    console.error('Scheduler error:', err);
  }
};

export const startScheduler = () => {
  // Run immediately on server start
  runInactiveCheck();

  // Then run every day at midnight
  cron.schedule('0 0 * * *', runInactiveCheck);

  console.log('Scheduler started');
};