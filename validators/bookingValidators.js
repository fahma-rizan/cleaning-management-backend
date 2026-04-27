const { z } = require('zod');

const TIME_SLOTS = [
  '9:00AM - 11:00AM',
  '11:00AM - 1:00PM',
  '2:00PM - 4:00PM',
  '4:00PM - 6:00PM',
];

const dateField = z
  .string({ required_error: 'date is required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format')
  .refine(val => !isNaN(Date.parse(val)), 'date must be a valid calendar date');

const timeField = z
  .string({ required_error: 'time is required' })
  .refine(val => TIME_SLOTS.includes(val), `time must be one of: ${TIME_SLOTS.join(', ')}`);

// POST /api/bookings
const createBookingSchema = z.object({
  date:            dateField,
  time:            timeField,
  address:         z.string({ required_error: 'address is required' }).min(5, 'address must be at least 5 characters'),
  price:           z.number({ required_error: 'price is required' }).positive('price must be greater than 0'),
  paymentMethod:   z.string({ required_error: 'paymentMethod is required' }).min(1, 'paymentMethod is required'),
  serviceName:     z.string().min(1).optional(),
  serviceCategory: z.string().min(1).optional(),
}).refine(
  data => data.serviceName || data.serviceCategory,
  { message: 'serviceName or serviceCategory is required', path: ['serviceName'] }
);

// PATCH /api/bookings/:id/reschedule
const rescheduleSchema = z.object({
  date: dateField,
  time: timeField,
});

// PATCH /api/bookings/:id/decline
const declineSchema = z.object({
  reason: z.string({ required_error: 'reason is required' }).min(3, 'reason must be at least 3 characters'),
});

// GET /api/bookings/slot-check?date=
const slotCheckSchema = z.object({
  date: dateField,
});

module.exports = {
  createBookingSchema,
  rescheduleSchema,
  declineSchema,
  slotCheckSchema,
};
