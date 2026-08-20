/**
 * Super admin seed script.
 * Run once to create the owner-level account — never via an API endpoint.
 *
 * Usage:  npm run seed:super-admin
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User     = require('../models/User');

const EMAIL    = process.env.SEED_SUPER_ADMIN_EMAIL    || 'superadmin@cloudlaundry.lk';
const PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD || 'SuperAdmin@1234';
const NAME     = process.env.SEED_SUPER_ADMIN_NAME     || 'Super Administrator';

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB:', process.env.MONGO_URI);

    const existing = await User.findOne({ email: EMAIL });
    if (existing) {
      if (existing.role !== 'super_admin') {
        existing.role = 'super_admin';
        await existing.save();
        console.log(`✔ Updated existing account to super_admin: ${EMAIL}`);
      } else {
        console.log(`Super admin already exists: ${EMAIL}`);
      }
    } else {
      await User.create({
        name:               NAME,
        email:              EMAIL,
        password:           PASSWORD,
        role:               'super_admin',
        isVerified:         true,
        isActive:           true,
        mustChangePassword: false,
      });
      console.log(`✔ Super admin created: ${EMAIL}`);
      console.log(`  Password: ${PASSWORD}`);
      console.log(`  ⚠  Change this password immediately after first login.`);
    }

    console.log('\n✅ Done.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
