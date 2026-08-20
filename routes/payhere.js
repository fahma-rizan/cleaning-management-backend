const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { determineInvoiceDetails, generateInvoiceNumber } = require('../utils/invoiceUtils');
const Refund = require('../models/Refund');
const Notification = require('../models/Notification');
const { sendPaymentConfirmationEmail } = require('../utils/emailService');

// @route   POST api/payhere/generate-hash
// @desc    Generate PayHere hash for payment
// @route   POST api/payhere/generate-hash
// @desc    Generate PayHere hash for payment
// @access  Private
router.post('/generate-hash', async (req, res) => {
  console.log('[/api/payhere/generate-hash] Received request with body:', req.body); // DEBUG
  try {
    const { bookingId, paymentMethod } = req.body;

    // 1. Fetch booking details (by Mongo ObjectId or bookingId string)
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(bookingId)) {
      booking = await Booking.findById(bookingId);
    }
    if (!booking) {
      booking = await Booking.findOne({ bookingId: bookingId });
    }

    console.log('[/api/payhere/generate-hash] Found booking:', booking); // DEBUG
    if (!booking) {
      console.error('[/api/payhere/generate-hash] Booking not found for ID:', bookingId); // DEBUG
      return res.status(404).json({ msg: 'Booking not found' });
    }

    const isFullPayment = paymentMethod === 'full-online';
    let amount;
    if (isFullPayment) {
      amount = booking.price;
    } else {
      // Fallback if advanceAmount is not on the booking object, calculate 20%
      amount = booking.advanceAmount || (booking.price * 0.20);
    }
    console.log('[/api/payhere/generate-hash] Calculated amount:', amount); // DEBUG

    // 2. Define PayHere payment object with valid customer details
    const serviceDescription = booking.serviceItems && booking.serviceItems.length > 0
      ? booking.serviceItems.map(item => item.name).join(', ')
      : booking.serviceName || booking.serviceType || 'Cleaning Service';

    const fullName = booking.customerName || 'Customer';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'Customer';
    const email = booking.customerEmail || booking.email || 'customer@example.com';
    const phone = booking.customerPhone || booking.phone || '0771234567';
    const address = booking.address || 'Colombo, Sri Lanka';

    const payment = {
      sandbox: 'true',
      merchant_id: process.env.PAYHERE_MERCHANT_ID,
      return_url: process.env.PAYHERE_RETURN_URL || `http://localhost:3000/payment-success`,
      cancel_url: process.env.PAYHERE_CANCEL_URL || `http://localhost:3000/payment-failed`,
      notify_url: process.env.PAYHERE_NOTIFY_URL || `http://localhost:4000/api/payhere/notify`,
      order_id: booking.bookingId || booking._id.toString(),
      items: `Booking for ${serviceDescription}`,
      currency: 'LKR',
      amount: amount.toFixed(2),
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
      address: address,
      city: 'Colombo',
      country: 'Sri Lanka',
    };

    // 3. Generate PayHere hash
    console.log('[/api/payhere/generate-hash] Merchant ID from env:', process.env.PAYHERE_MERCHANT_ID); // DEBUG
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hashString = `${payment.merchant_id}${payment.order_id}${payment.amount}${payment.currency}${hashedSecret}`;
    const hash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

    // Use unified utility for categorization
    const { prefix, categories } = determineInvoiceDetails(booking.serviceItems);
    const invoiceNumber = await generateInvoiceNumber(prefix);

    // Construct a full invoice object for the success page
    const invoice = {
      invoiceNumber,
      mainCategories: categories,
      invoiceType: isFullPayment ? 'FULL' : 'ADVANCE',
      date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      bookingId: booking.bookingId || 'N/A',
      customer: {
        name: fullName,
        email: email,
        phone: phone,
        address: address,
      },
      service: {
        name: serviceDescription,
        date: booking.date ? new Date(booking.date).toLocaleDateString('en-CA') : 'N/A',
        time: booking.time || 'N/A',
        customizations: [],
      },
      pricing: {
        basePrice: booking.price || 0,
        customizationTotal: (booking.service?.customizations || []).reduce((acc, curr) => acc + (curr.price || 0), 0),
        discount: booking.discount || 0,
        couponCode: booking.couponCode || '',
        tax: booking.tax || 0,
        transportCharge: booking.transportFee || 0,
        total: booking.finalAmount || booking.price || 0,
        paidAmount: amount,
        balanceAmount: (booking.finalAmount || booking.price || 0) - amount,
      },
      paymentMethod: 'PayHere Online',
      status: 'pending',
    };

    res.json({ payhere_payment: payment, hash, booking, invoice });
  } catch (err) {
    console.error('Error generating PayHere hash:', err.message);
    res.status(500).json({ msg: 'Server error while generating payment hash. Please try again later.' });
  }
});

// @route   POST api/payhere/notify
// @desc    Handle PayHere payment notification
// @access  Public
router.post('/notify', async (req, res) => {
  try {
    // Rename order_id to bookingId for consistency with our internal models
    const { order_id: bookingId, payment_id, payhere_amount, payhere_currency, status_code, md5sig } = req.body;

    // 1. Validate signature
    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    const localMd5sig = crypto.createHash('md5').update(
        `${merchantId}${bookingId}${payhere_amount}${payhere_currency}${status_code}${crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase()}`
    ).digest('hex').toUpperCase();

    if (localMd5sig !== md5sig) {
      console.error('Invalid PayHere signature');
      return res.status(400).send('Invalid signature');
    }

    // 2. Process successful payment
    if (status_code == 2) { // 2 indicates a successful payment
      const booking = await Booking.findOne({ bookingId }); // Use the renamed variable
      if (!booking) {
        console.error(`Booking not found for bookingId: ${bookingId}`);
        return res.status(404).send('Booking not found');
      }

      const paidAmount = parseFloat(payhere_amount);
      const isFullPayment = paidAmount === booking.price;

      // Backwards-compatibility fixes for older seed data
      // Normalize legacy fields to current schema
      booking.customerId = booking.customerId || booking.userId || booking.customerId;
      booking.serviceName = booking.serviceName || booking.serviceType || booking.serviceName;

      console.log('[/api/payhere/notify] Booking before save (toObject):', booking.toObject ? booking.toObject() : booking);

      // Update booking status
      booking.status = isFullPayment ? 'confirmed' : 'confirmed'; // advance-paid maps to confirmed in master schema

      // Some legacy seed records lack required fields. To ensure we can update
      // status from the payment gateway without failing validation, save the
      // document without running validators when necessary.
      try {
        await booking.save();
      } catch (saveErr) {
        console.warn('[/api/payhere/notify] booking.save() failed, retrying without validation:', saveErr.message);
        await booking.save({ validateBeforeSave: false });
      }

      // Find or create invoice
      let invoice = await Invoice.findOne({ bookingId: booking._id });

      // If booking lacks customer email/name, try to fetch User (do this whether invoice exists or not)
      let userRecord = null;
      if (!booking.email && (booking.customerId || booking.userId)) {
        const lookupId = booking.customerId || booking.userId;
        try {
          userRecord = await User.findById(lookupId).lean();
        } catch (e) {
          console.warn('[/api/payhere/notify] User lookup failed for', lookupId, e.message);
        }
      }

      if (!invoice) {
        // Use utility to determine categorization details
        const { prefix, categories } = determineInvoiceDetails(booking.serviceItems);
        const invoiceNumber = await generateInvoiceNumber(prefix);

        invoice = new Invoice({
          invoiceNumber,
          mainCategories: categories,
          invoiceType: isFullPayment ? 'FULL' : 'ADVANCE',
          customer: {
            userId: booking.customerId || booking.userId || (userRecord && userRecord._id) || null,
            name: booking.customerName || (userRecord && (userRecord.name || `${userRecord.firstName || ''} ${userRecord.lastName || ''}`)) || 'N/A',
            email: booking.email || (userRecord && userRecord.email) || 'no-reply@local.invalid',
            phone: booking.customerPhone || (userRecord && userRecord.phone) || 'N/A',
            address: booking.address || (userRecord && userRecord.address) || 'N/A',
          },
          bookingId: booking._id,
          serviceItems: booking.serviceItems || [{ name: booking.serviceName || booking.serviceType || 'Service', price: booking.price, quantity: 1 }],
          subTotal: booking.price,
          totalAmount: booking.price,
          balanceAmount: booking.price - paidAmount,
        });
      } else {
        // Existing invoice: ensure required customer fields are present to avoid validation errors
        invoice.customer = invoice.customer || {};
        invoice.customer.userId = invoice.customer.userId || booking.customerId || booking.userId || (userRecord && userRecord._id) || null;
        invoice.customer.name = invoice.customer.name || booking.customerName || (userRecord && (userRecord.name || `${userRecord.firstName || ''} ${userRecord.lastName || ''}`)) || 'N/A';
        invoice.customer.email = invoice.customer.email || booking.email || (userRecord && userRecord.email) || 'no-reply@local.invalid';
        invoice.customer.phone = invoice.customer.phone || booking.customerPhone || (userRecord && userRecord.phone) || 'N/A';
        invoice.customer.address = invoice.customer.address || booking.address || (userRecord && userRecord.address) || 'N/A';
      }

      // Update invoice
      invoice.status = isFullPayment ? 'PAID' : 'PARTIAL';
      const newPaidAmount = (invoice.paidAmount || 0) + paidAmount;
      invoice.paidAmount = parseFloat(newPaidAmount.toFixed(2)); // Round to 2 decimal places
      invoice.balanceAmount = parseFloat((invoice.totalAmount - invoice.paidAmount).toFixed(2));
      invoice.payherePaymentId = payment_id; // Save PayHere ID for potential refunds
      invoice.history.push({
        event: 'PAYMENT_RECEIVED',
        details: `LKR ${paidAmount.toFixed(2)} received via PayHere. Payment ID: ${payment_id}`,
        timestamp: new Date(),
      });
      await invoice.save();

      // Notify admin via Socket.IO
      const io = req.app.get('socketio');
      if (io) {
        io.to('admin-room').emit('payment-update', invoice);
      }

      // 3. Create a notification for the user
      if (booking.customerId) {
        const notification = new Notification({
          customerId: booking.customerId,
          type: 'payment',
          title: 'Payment Successful',
          message: `Your payment of LKR ${paidAmount.toFixed(2)} for booking ${booking.bookingId} was successful.`,
          actionUrl: `/invoice/${booking.bookingId}`,
          bookingId: booking.bookingId,
        });
        await notification.save();
        
        // 4. Send a payment confirmation email
        await sendPaymentConfirmationEmail(invoice);
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('PayHere Notify Error:', err);
    res.status(500).json({ msg: 'Server error while processing payment notification.' });
  }
});

// @route   POST api/payhere/refund
// @desc    Refund a specific amount via PayHere API
// @access  Private
router.post('/refund', async (req, res) => {
  try {
    const { bookingId, amount, description } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({ msg: 'Please provide bookingId and amount' });
    }

    // 1. Fetch Invoice
    const invoice = await Invoice.findOne({ bookingId });
    if (!invoice || !invoice.payherePaymentId) {
      return res.status(404).json({ msg: 'Invoice not found or no PayHere payment ID associated' });
    }

    // 6. Validate refund amount
    if (parseFloat(amount) > invoice.paidAmount) {
      return res.status(400).json({ msg: `Refund amount (LKR ${amount}) cannot exceed the paid amount (LKR ${invoice.paidAmount})` });
    }

    const appId = process.env.PAYHERE_APP_ID;
    const appSecret = process.env.PAYHERE_APP_SECRET;

    if (!appId || !appSecret) {
      console.error('PayHere App ID or Secret is missing in .env');
      return res.status(500).json({ msg: 'Payment gateway configuration error. App ID and Secret required.' });
    }

    // 2. Get Access Token from PayHere
    const authString = Buffer.from(`${appId}:${appSecret}`).toString('base64');
    
    const tokenResponse = await fetch('https://sandbox.payhere.lk/merchant/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Error fetching PayHere token:', tokenData);
      return res.status(500).json({ msg: 'Failed to authenticate with payment gateway' });
    }

    const accessToken = tokenData.access_token;

    // 3. Initiate Refund
    const refundResponse = await fetch('https://sandbox.payhere.lk/merchant/v1/payment/refund', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        payment_id: invoice.payherePaymentId,
        description: description || 'Refund',
        amount: parseFloat(amount)
      })
    });

    const refundData = await refundResponse.json();

    if (!refundResponse.ok || refundData.status !== 1) {
      console.error('PayHere Refund Error:', refundData);
      return res.status(400).json({ msg: 'Refund failed at payment gateway', details: refundData.msg || refundData });
    }

    // 4. Update Database
    const refundAmount = parseFloat(amount);
    const newPaidAmount = invoice.paidAmount - refundAmount;
    invoice.paidAmount = parseFloat(newPaidAmount.toFixed(2));

    if (invoice.paidAmount < 0) invoice.paidAmount = 0;
    invoice.balanceAmount = parseFloat((invoice.totalAmount - invoice.paidAmount).toFixed(2));
    
    if (invoice.paidAmount === 0) {
      invoice.status = 'REFUNDED';
    }

    invoice.history.push({
      event: 'REFUND_PROCESSED',
      details: `LKR ${parseFloat(amount).toFixed(2)} refunded via PayHere. Reason: ${description || 'N/A'}`,
      timestamp: new Date(),
    });

    await invoice.save();

    // 5. Create a record in the Refunds collection for tracking
    const newRefund = new Refund({
      invoice: invoice._id,
      reason: description || 'Refund processed by admin',
      status: 'APPROVED', // Directly approved as it's an admin action
      refundedAmount: refundAmount,
    });
    await newRefund.save();

    res.json({ 
      msg: 'Refund processed successfully', 
      refundedAmount: amount,
      invoiceStatus: invoice.status 
    });

  } catch (err) {
    console.error('PayHere Refund Error:', err.message);
    res.status(500).json({ msg: 'Server error during the refund process.' });
  }
});

module.exports = router;