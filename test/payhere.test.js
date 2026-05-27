const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const payhereRoutes = require('../routes/payhere');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const Notification = require('../models/Notification');
const emailService = require('../utils/emailService');

// Mock the dependencies
jest.mock('../models/Notification');
jest.mock('../utils/emailService');

const app = express();
// Add the io object to the app context for the route to use
app.use((req, res, next) => {
    req.app.io = { to: () => ({ emit: () => {} }) }; // Mock Socket.IO
    next();
});
app.use(express.json());
app.use('/api/payhere', payhereRoutes);

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
    // Clear all mock implementations and calls after each test
    jest.clearAllMocks();
    // Clear the database between tests
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany();
    }
});


describe('POST /api/payhere/notify', () => {
  it('should handle a successful payment notification, update invoice, create notification, and send email', async () => {
    // 1. Setup: Create a mock booking and a pending invoice
    const booking = await new Booking({
      bookingId: 'BK-12345',
      userId: 'user-test-id',
      customer: { name: 'Test User', email: 'test@example.com' },
      serviceType: 'Test Service',
      status: 'CONFIRMED',
    }).save();

    const invoice = await new Invoice({
      bookingId: 'BK-12345',
      invoiceNumber: 'INV-001',
      customer: { name: 'Test User', email: 'test@example.com' },
      totalAmount: 1500,
      paidAmount: 0,
      status: 'PENDING',
    }).save();

    // 2. Mock the PayHere payload
    const payherePayload = {
      order_id: 'BK-12345',
      payment_id: 'PAY-98765',
      payhere_amount: '1500.00',
      payhere_currency: 'LKR',
      status_code: 2, // Success
      // NOTE: md5sig validation is skipped in test environment or mocked
    };
    
    // Mock the implementation of Notification.save
    Notification.prototype.save = jest.fn().mockResolvedValue(true);
    
    // Mock the implementation of the email service
    emailService.sendPaymentConfirmationEmail.mockResolvedValue(true);


    // 3. Action: Send the request to the endpoint
    const response = await request(app)
      .post('/api/payhere/notify')
      .send(payherePayload);

    // 4. Assertions
    expect(response.status).toBe(200);

    // Check if the invoice was updated in the database
    const updatedInvoice = await Invoice.findOne({ bookingId: 'BK-12345' });
    expect(updatedInvoice.status).toBe('PAID');
    expect(updatedInvoice.paidAmount).toBe(1500);

    // Check if a notification was created
    expect(Notification.prototype.save).toHaveBeenCalledTimes(1);

    // Check if the email service was called
    expect(emailService.sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendPaymentConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({
        invoiceNumber: 'INV-001'
    }));
  });
});