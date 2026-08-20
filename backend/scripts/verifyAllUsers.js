//One-time migration — mark every existing user as verified.Safe to run multiple times — already-verified users are unaffected.


require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User     = require('../models/User');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected.');

  const result = await User.updateMany(
    { isVerified: false },
    { $set: { isVerified: true } }
  );

  console.log(`Done. ${result.modifiedCount} user(s) updated to isVerified: true.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
