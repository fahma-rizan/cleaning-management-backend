const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const { determineInvoiceDetails, generateInvoiceNumber } = require('../utils/invoiceUtils');
const Refund = require('../models/Refund');
const Notification = require('../models/Notification');
const { sendPaymentConfirmationEmail } = require('../utils/emailService');

// @route   POST api/payhere/generate-hash
// @desc    Generate PayHere hash for payment
// @access  Private
router.post('/generate-hash', async (req, res) => {
  console.log('[/api/payhere/generate-hash] Received request with body:', req.body); // DEBUG
  try {
    const { bookingId, paymentMethod } = req.body;

    // 1. Fetch booking details
    const booking = await Booking.findById(bookingId);
    console.log('[/api/payhere/generate-hash] Found booking:', booking); // DEBUG
    if (!booking) {
      console.error('[/api/payhere/generate-hash] Booking not found for ID:', bookingId); // DEBUG
      return res.status(404).json({ msg: 'Booking not found' });
    }

    const isFullPayment = paymentMethod === 'full-online';
    const amount = isFullPayment ? booking.price : booking.advanceAmount;
    console.log('[/api/payhere/generate-hash] Calculated amount:', amount); // DEBUG

    // 2. Define PayHere payment object
    const payment = {
      sandbox: 'true',
      merchant_id: process.env.PAYHERE_MERCHANT_ID,
      return_url: process.env.PAYHERE_RETURN_URL || `http://localhost:3006/payment-success`,
      cancel_url: process.env.PAYHERE_CANCEL_URL || `http://localhost:3006/payment-failed`,
      notify_url: process.env.PAYHERE_NOTIFY_URL || `http://localhost:4000/api/payhere/notify`,
      order_id: booking.bookingId,
      items: `Booking for ${booking.serviceType}`,
      currency: 'LKR',
      amount: amount.toFixed(2),
      first_name: 'N/A',
      last_name: 'N/A',
      email: booking.email,
      phone: 'N/A',
      address: booking.address,
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
        name: booking.customer?.name || 'N/A',
        email: booking.customer?.email || 'N/A',
        phone: booking.customer?.phone || 'N/A',
        address: booking.customer?.address || 'N/A',
      },
      service: {
        name: booking.service?.name || 'N/A',
        date: booking.service?.date ? new Date(booking.service.date).toLocaleDateString('en-CA') : 'N/A',
        time: booking.service?.time || 'N/A',
        customizations: booking.service?.customizations || [],
      },
      pricing: {
        basePrice: booking.price || 0,
        customizationTotal: (booking.service?.customizations || []).reduce((acc, curr) => acc + (curr.price || 0), 0),
        discount: booking.discount || 0,
        couponCode: booking.couponCode || '',
        tax: booking.tax || 0,
        transportCharge: booking.transportFee || 0,
        total: booking.finalAmount || 0,
        paidAmount: amount,
        balanceAmount: (booking.finalAmount || 0) - amount,
      },
      paymentMethod: 'PayHere Online',
      status: 'PENDING', // Status is pending until payment is confirmed
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

      // Update booking status
      booking.status = isFullPayment ? 'CONFIRMED' : 'ADVANCE_PAID';
      await booking.save();

      // Find or create invoice
      let invoice = await Invoice.findOne({ bookingId: booking.bookingId });
      if (!invoice) {
        // Use utility to determine categorization details
        const { prefix, categories } = determineInvoiceDetails(booking.serviceItems);
        const invoiceNumber = await generateInvoiceNumber(prefix);

        invoice = new Invoice({
          invoiceNumber,
          mainCategories: categories,
          invoiceType: isFullPayment ? 'FULL' : 'ADVANCE',
          customer: {
            userId: booking.userId,
            name: booking.customer?.name || 'N/A',
            email: booking.email,
            phone: booking.customer?.phone || 'N/A',
            address: booking.address,
          },
          bookingId: booking.bookingId,
          serviceItems: booking.serviceItems || [{ name: booking.serviceType, price: booking.price, quantity: 1 }],
          subTotal: booking.price,
          totalAmount: booking.price,
          balanceAmount: booking.price - paidAmount,
        });
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
      if (booking.userId) {
        const notification = new Notification({
          userId: booking.userId,
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
    console.error('PayHere Notify Error:', err.message);
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