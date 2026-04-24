const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const { sendPaymentConfirmationEmail } = require('../utils/emailService');

// Helper function to get next sequence value for invoice numbers
async function getNextSequenceValue(sequenceName) {
  const counter = await Counter.findOneAndUpdate(
    { name: sequenceName },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return counter.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Literal/specific routes MUST be defined BEFORE dynamic /:param
// routes. Express matches top-to-bottom, so /payhere and /payhere/ipn must
// come before /:invoiceNumber and /:id or they will never be reached.
// FIX (Bug 2): Reordered all routes — literals first, dynamics last.
// ─────────────────────────────────────────────────────────────────────────────

// ── @route   POST /api/invoices/payhere ───────────────────────────────────────
// @desc    Create a PayHere checkout session and return the form params
// @access  Private
router.post('/payhere', async (req, res) => {
  try {
    const { amount, bookingId, customerName, customerEmail, customerPhone } = req.body;

    // FIX (Bug 5): Validate amount before calling toFixed to avoid TypeError
    const numericAmount = parseFloat(amount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ msg: 'A valid positive amount is required.' });
    }

    // FIX (High): Use environment variables; fail if not configured (no hardcoded fallbacks)
    if (!process.env.PAYHERE_MERCHANT_ID || !process.env.PAYHERE_MERCHANT_SECRET) {
      console.error('PayHere credentials not configured in environment variables');
      return res.status(500).json({ msg: 'Payment gateway not configured' });
    }

    const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
    const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;
    const RETURN_URL = process.env.PAYHERE_RETURN_URL || 'http://localhost:3000/payment-success';
    const CANCEL_URL = process.env.PAYHERE_CANCEL_URL || 'http://localhost:3000/payment';
    const NOTIFY_URL = process.env.PAYHERE_NOTIFY_URL || 'http://localhost:4000/api/invoices/payhere/ipn';

    // Generate payment parameters
    const params = {
      merchant_id: MERCHANT_ID,
      return_url: RETURN_URL,
      cancel_url: CANCEL_URL,
      notify_url: NOTIFY_URL,
      order_id: bookingId,
      items: 'Service Payment',
      amount: numericAmount.toFixed(2),
      currency: 'LKR',
      first_name: customerName,
      last_name: '',
      email: customerEmail,
      phone: customerPhone,
      address: '',
      city: '',
      country: 'Sri Lanka',
    };

    // Generate signature (required for PayHere)
    // Note: The order of parameters is critical for signature validation
    const signature = crypto.createHash('md5')
      .update(`${params.merchant_id}${params.order_id}${params.amount}${params.currency}${params.first_name}${params.last_name}${params.email}${params.phone}${params.address}${params.city}${params.country}${params.items}${params.return_url}${params.cancel_url}${params.notify_url}${MERCHANT_SECRET}`)
      .digest('hex');

    params.hash = signature;

    res.json({ 
      payhereUrl: process.env.PAYHERE_URL || 'https://sandbox.payhere.lk/pay/checkout', // Sandbox URL
      params 
    });
  } catch (error) {
    console.error('Error creating PayHere payment:', error.message);
    res.status(500).send('Server Error');
  }
});

// ── @route   POST /api/invoices/payhere/ipn ───────────────────────────────────
// @desc    Handle PayHere Instant Payment Notification (IPN)
// @access  Public (PayHere webhook)
router.post('/payhere/ipn', async (req, res) => {
  try {
    const { 
      merchant_id, order_id, payment_id, status_code, status_message, 
      amount, currency, hash 
    } = req.body;

    // FIX (High): Use environment variables instead of hardcoded values
    if (!process.env.PAYHERE_MERCHANT_SECRET) {
      console.error('[PayHere IPN] PAYHERE_MERCHANT_SECRET not configured');
      return res.status(500).send('Server configuration error');
    }

    const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;
    const expectedHash = crypto.createHash('md5')
      .update(`${merchant_id}${order_id}${payment_id}${status_code}${status_message}${amount}${currency}${MERCHANT_SECRET}`)
      .digest('hex');

    if (hash !== expectedHash) {
      console.error('[PayHere IPN] Invalid signature received');
      return res.status(400).send('Invalid signature');
    }

    // Update invoice status based on PayHere response
    if (status_code === '2') { // Payment successful
      const invoice = await Invoice.findOne({ bookingId: order_id });

      if (!invoice) {
        console.error(`[PayHere IPN] No invoice found for bookingId: ${order_id}`);
        // Still respond 200 so PayHere doesn't keep retrying
        return res.status(200).send('IPN received — invoice not found');
      }

      // Only update if not already paid (idempotency guard)
      if (invoice.status !== 'PAID') {
        invoice.status      = 'PAID';
        invoice.paidAmount  = parseFloat(amount);
        invoice.balanceAmount = 0;

        // FIX (Bug 9): history is now in the schema so this actually saves
        invoice.history.push({
          event:     'PayHere Payment Received',
          timestamp: new Date(),
          details:   `PayHere payment of Rs. ${amount} (LKR) received. Status: ${status_code}`,
        });

        await invoice.save();

        // Real-time update to all connected browsers
        const io = req.app.get('socketio');
        if (io) io.emit('invoiceUpdate', invoice);

        // Email confirmation to customer
        sendPaymentConfirmationEmail(invoice);

        console.log(`[PayHere IPN] Invoice ${invoice.invoiceNumber} marked PAID for order ${order_id}`);
      }
    } else {
      console.log(`[PayHere IPN] Non-success status ${status_code} received for order ${order_id}`);
    }

    // Always respond 200 to PayHere — any other status causes retries
    res.status(200).send('IPN received');

  } catch (error) {
    console.error('Error handling PayHere IPN:', error.message);
    // Still respond 200 so PayHere doesn't keep retrying
    res.status(200).send('IPN received with error');
  }
});

// ── @route   GET /api/invoices ───────────────────────────────────────────────
// @desc    Get all invoices
router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error.message);
    res.status(500).send('Server Error');
  }
});

// ── @route   GET /api/invoices/booking/:bookingId ────────────────────────────
// @desc    Get invoice by booking ID (must come BEFORE generic /:id route)
// FIX (Critical): Added public endpoint to fetch invoice by booking ID
router.get('/booking/:bookingId', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ bookingId: req.params.bookingId });
    if (!invoice) {
      return res.status(404).json({ msg: 'Invoice not found for this booking.' });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice by booking ID:', error.message);
    res.status(500).send('Server Error');
  }
});

// ── @route   GET /api/invoices/user/:userId ────────────────────────────────────
// @desc    Get all invoices for a specific user (must come BEFORE generic /:id route)
// FIX (Critical): Added public endpoint to fetch user's invoices
router.get('/user/:userId', async (req, res) => {
  try {
    const invoices = await Invoice.find({ 'customer.userId': req.params.userId }).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching user invoices:', error.message);
    res.status(500).send('Server Error');
  }
});

// ── @route   POST /api/invoices ───────────────────────────────────────────────
// @desc    Create a new invoice (used by customer payment flow and staff)
router.post('/', async (req, res) => {
  try {
    const sequenceNumber = await getNextSequenceValue('invoiceNumber');
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');

    const servicePrefixes = {
      'Home Cleaning':                   'HC',
      'Curtain Cleaning':                'CC',
      'Laundry Cleaning':                'LC',
      'Sofa/Mattress Interior Cleaning': 'SM',
    };

    const firstServiceItemName = req.body.serviceItems?.[0]?.name || '';
    const serviceCode = servicePrefixes[firstServiceItemName] || 'GEN';
    const invoiceNumber = `INV-${serviceCode}-${dateStr}-${sequenceNumber.toString().padStart(4, '0')}`;

    const newInvoice = new Invoice({
      ...req.body,
      invoiceNumber,
    });

    if (!newInvoice.totalAmount) {
      return res.status(400).json({ msg: 'Request body is missing required invoice fields.' });
    }

    const invoice = await newInvoice.save();

    // Send email in background — do not await so response is fast
    sendPaymentConfirmationEmail(invoice);

    // Notify all connected admin dashboards
    const io = req.app.get('socketio');
    io.emit('newInvoice', invoice);

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error creating invoice:', error.message);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'An invoice with this number already exists.' });
    }
    res.status(500).send('Server Error');
  }
});

// ── @route   POST /api/invoices/:id/mark-as-paid ─────────────────────────────
// @desc    Mark a COD invoice as fully paid (staff use)
// NOTE: This must stay BEFORE /:invoiceNumber to avoid /:id swallowing it,
// but since it is POST and /:invoiceNumber is GET there is no actual clash.
// Keeping it here for clarity.
router.post('/:id/mark-as-paid', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ msg: 'Invoice not found' });
    }

    invoice.paidAmount    = invoice.totalAmount;
    invoice.balanceAmount = 0;
    invoice.status        = 'PAID';

    // FIX (Bug 9): history is in the schema now so this persists correctly
    invoice.history.push({
      event:     'Marked as Paid',
      timestamp: new Date(),
      details:   'Cash payment confirmed by staff.',
    });

    const updatedInvoice = await invoice.save();

    const io = req.app.get('socketio');
    io.emit('invoiceUpdate', updatedInvoice);

    sendPaymentConfirmationEmail(updatedInvoice);

    res.json(updatedInvoice);
  } catch (error) {
    console.error('Error marking invoice as paid:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Invoice not found' });
    }
    res.status(500).send('Server Error');
  }
});

// ── @route   PUT /api/invoices/:invoiceNumber/status ─────────────────────────
// @desc    Update the status of an invoice
router.put('/:invoiceNumber/status', async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = Invoice.schema.path('status').enumValues;
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const invoice = await Invoice.findOne({ invoiceNumber: req.params.invoiceNumber });

    if (!invoice) {
      return res.status(404).json({ msg: 'Invoice not found.' });
    }

    invoice.status = status;
    await invoice.save();

    res.json(invoice);
  } catch (error) {
    console.error('Error updating invoice status:', error.message);
    res.status(500).send('Server Error');
  }
});

// ── @route   GET /api/invoices/:invoiceNumber ─────────────────────────────────
// @desc    Get a single invoice by its invoice number string
router.get('/:invoiceNumber', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ invoiceNumber: req.params.invoiceNumber });

    if (!invoice) {
      return res.status(404).json({ msg: 'Invoice not found.' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching single invoice:', error.message);
    res.status(500).send('Server Error');
  }
});

// ── @route   DELETE /api/invoices/:id ────────────────────────────────────────
// @desc    Delete an invoice by its MongoDB ObjectId
router.delete('/:id', async (req, res) => {
  try {
    // FIX (Bug 8): invoice.remove() is deprecated/removed in Mongoose 7+.
    // Using findByIdAndDelete() instead which works in all modern versions.
    const invoice = await Invoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      return res.status(404).json({ msg: 'Invoice not found' });
    }

    res.json({ msg: 'Invoice removed' });
  } catch (error) {
    console.error('Error deleting invoice:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Invoice not found' });
    }
    res.status(500).send('Server Error');
  }
});

// ── @route   POST /api/invoices/:id/generate-payment-link ─────────────────────
// @desc    Generate a payment link for "Pay After Completion" payments
router.post('/:id/generate-payment-link', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ msg: 'Invoice not found' });
    }

    if (invoice.status === 'PAID') {
      return res.status(400).json({ msg: 'Invoice is already paid' });
    }

    const amount = invoice.balanceAmount > 0 ? invoice.balanceAmount : invoice.totalAmount;

    // Generate a unique payment link ID
    const paymentLinkId = crypto.randomBytes(16).toString('hex');
    const paymentLink = `http://localhost:3000/payment-link/${paymentLinkId}`;

    // Store payment link info in invoice history
    invoice.history.push({
      event: 'Payment Link Generated',
      timestamp: new Date(),
      details: `Payment link generated for Rs. ${amount} (LKR)`,
    });

    await invoice.save();

    res.json({
      paymentLink,
      paymentLinkId,
      amount,
      invoiceNumber: invoice.invoiceNumber,
      bookingId: invoice.bookingId,
    });
  } catch (error) {
    console.error('Error generating payment link:', error.message);
    res.status(500).send('Server Error');
  }
});

// ── @route   POST /api/invoices/:id/pay-balance ───────────────────────────────
// @desc    Pay the remaining balance on an invoice
router.post('/:id/pay-balance', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ msg: 'Invoice not found' });
    }

    if (invoice.status === 'PAID') {
      return res.status(400).json({ msg: 'Invoice is already paid' });
    }

    const balanceAmount = invoice.balanceAmount;
    if (balanceAmount <= 0) {
      return res.status(400).json({ msg: 'No balance due on this invoice' });
    }

    // Process payment (would integrate with PayHere in a real app)
    // For now, we'll just mark it as paid
    invoice.paidAmount += balanceAmount;
    invoice.balanceAmount = 0;
    invoice.status = 'PAID';

    // Add payment history
    invoice.history.push({
      event: 'Balance Payment Received',
      timestamp: new Date(),
      details: `Balance payment of Rs. ${balanceAmount} (LKR) received`,
    });

    await invoice.save();

    // Real-time update
    const io = req.app.get('socketio');
    if (io) io.emit('invoiceUpdate', invoice);

    // Send confirmation email
    sendPaymentConfirmationEmail(invoice);

    res.json(invoice);
  } catch (error) {
    console.error('Error processing balance payment:', error.message);
    res.status(500).send('Server Error');
  }
});

// ── @route   GET /api/invoices/reports/financial ─────────────────────────────
// @desc    Generate financial reports
router.get('/reports/financial', async (req, res) => {
  try {
    const { startDate, endDate, status, paymentMethod } = req.query;

    const filters = {};

    // Date range filter
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    // Status filter
    if (status) {
      filters.status = status;
    }

    // Fetch invoices
    const invoices = await Invoice.find(filters).sort({ createdAt: -1 });

    // Calculate financial metrics
    const metrics = {
      totalInvoices: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      totalPaid: invoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
      totalBalance: invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0),
      paidInvoices: invoices.filter(inv => inv.status === 'PAID').length,
      partialInvoices: invoices.filter(inv => inv.status === 'PARTIAL').length,
      pendingInvoices: invoices.filter(inv => inv.status === 'SENT' || inv.status === 'DRAFT').length,
    };

    // Group by status
    const statusBreakdown = invoices.reduce((acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      return acc;
    }, {});

    // Group by month
    const monthlyBreakdown = invoices.reduce((acc, inv) => {
      const month = inv.createdAt.toISOString().substring(0, 7); // YYYY-MM
      acc[month] = {
        count: (acc[month]?.count || 0) + 1,
        amount: (acc[month]?.amount || 0) + inv.totalAmount,
        paid: (acc[month]?.paid || 0) + inv.paidAmount,
      };
      return acc;
    }, {});

    res.json({
      metrics,
      statusBreakdown,
      monthlyBreakdown,
      invoices: invoices.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        bookingId: inv.bookingId,
        customerName: inv.customer.name,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        balanceAmount: inv.balanceAmount,
        status: inv.status,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error generating financial report:', error.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;