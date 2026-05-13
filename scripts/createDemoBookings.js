/**
 * Creates 5 demo bookings (Mon–Fri of next calendar week) and generates
 * a MaterialRequest for each via calculateMaterialNeeds.
 *
 * Usage: node backend/scripts/createDemoBookings.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

/* ── Helper: next Monday from today ──────────────────────────── */
const nextWeekday = (dayOffset) => {
  const now  = new Date();
  const day  = now.getDay(); // 0 = Sun, 1 = Mon, …
  const daysUntilMonday = day === 0 ? 1 : (8 - day);
  const date = new Date(now);
  date.setDate(now.getDate() + daysUntilMonday + dayOffset);
  date.setHours(9, 0, 0, 0);
  return date;
};

const DEMO_BOOKINGS = [
  {
    label:            'Mon — House Deep Clean',
    serviceType:      'house_deep_cleaning',
    subType:          'normal',
    usageFactor:      'square_feet',
    usageFactorValue: 350,
    dayOffset:        0,
  },
  {
    label:            'Tue — Commercial Clean',
    serviceType:      'commercial_cleaning',
    subType:          'normal',
    usageFactor:      'square_feet',
    usageFactorValue: 800,
    dayOffset:        1,
  },
  {
    label:            'Wed — Carpet Cleaning',
    serviceType:      'carpet_cleaning',
    subType:          'standard',
    usageFactor:      'square_feet',
    usageFactorValue: 200,
    dayOffset:        2,
  },
  {
    label:            'Thu — Sofa Cleaning',
    serviceType:      'sofa_cleaning',
    subType:          'standard',
    usageFactor:      'seats',
    usageFactorValue: 4,
    dayOffset:        3,
  },
  {
    label:            'Fri — Curtain Cleaning',
    serviceType:      'curtain_cleaning',
    subType:          'laundry',
    usageFactor:      'curtains',
    usageFactorValue: 6,
    dayOffset:        4,
  },
];

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB\n');

  const { Booking, User, MaterialRequest } = require('../models/index');
  const { calculateMaterialNeeds }         = require('../services/materialRequestService');

  const customer = await User.findOne({ role: 'customer', isActive: true });
  if (!customer) {
    console.error('No active customer found. Please seed a customer first.');
    return mongoose.disconnect();
  }

  console.log(`Using customer: ${customer.name} (${customer.email})\n`);

  for (const demo of DEMO_BOOKINGS) {
    const scheduledDate = nextWeekday(demo.dayOffset);

    try {
      const booking = await Booking.create({
        customerId:       customer._id,
        serviceType:      demo.serviceType,
        subType:          demo.subType,
        usageFactor:      demo.usageFactor,
        usageFactorValue: demo.usageFactorValue,
        scheduledDate,
        materialStatus:   'pending_materials',
      });

      let requestSummary = 'No material request generated';
      try {
        const req = await calculateMaterialNeeds(booking._id);
        const itemCount = (req?.consumables?.length ?? 0) + (req?.equipment?.length ?? 0);
        requestSummary = `MaterialRequest ${req._id} — ${itemCount} item type(s)`;
      } catch (reqErr) {
        requestSummary = `MaterialRequest failed: ${reqErr.message}`;
      }

      console.log(`✓ ${demo.label}`);
      console.log(`  Booking ID   : ${booking._id}`);
      console.log(`  Scheduled    : ${scheduledDate.toDateString()}`);
      console.log(`  Service      : ${demo.serviceType} / ${demo.subType} / ${demo.usageFactorValue} ${demo.usageFactor}`);
      console.log(`  ${requestSummary}`);
      console.log();
    } catch (err) {
      console.error(`✗ ${demo.label} — ${err.message}\n`);
    }
  }

  console.log('Done.');
  mongoose.disconnect();
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
  process.exit(1);
});
