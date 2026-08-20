const Invoice       = require('../models/Invoice');
const Booking       = require('../models/Booking');
const Notification  = require('../models/Notification');
const Counter       = require('../models/Counter');
const { determineInvoiceDetails, generateInvoiceNumber } = require('../utils/invoiceUtils');
const { sendPaymentConfirmationEmail, sendInvoiceEmail } = require('../utils/emailService');
const payhereService = require('../services/payhereService');
const { emitEvent, emitToUser } = require('../sockets/socketManager');

// ── createPayhereCheckout ─────────────────────────────────────────────────
// FIX: determineInvoiceDetails was called with wrong args (paymentMethod, amount).
//      Correct signature is determineInvoiceDetails(serviceItems[]).
exports.createPayhereCheckout = async (req, res) => {
  try {
    const { bookingId, paymentMethod, serviceType, amount, customer } = req.body;
    if (!bookingId || !paymentMethod || !serviceType || !amount || !customer) {
      return res.status(400).json({ msg: 'Missing required fields for invoice creation.' });
    }

    // FIX: coerce amount to Number — req.body values are strings; using them
    // in arithmetic without coercion risks string concatenation bugs and
    // saves string literals to MongoDB numeric fields.
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ msg: 'Invalid amount — must be a positive number.' });
    }

    const serviceItems = [{ name: serviceType, price: amountNum }];
    const { prefix, categories } = determineInvoiceDetails(serviceItems);
    const invoiceNumber = await generateInvoiceNumber(prefix);

    const isAdvance     = paymentMethod.includes('advance');
    const paidAmount    = isAdvance ? parseFloat((amountNum * 0.20).toFixed(2)) : amountNum;
    const balanceAmount = parseFloat((amountNum - paidAmount).toFixed(2));

    const newInvoice = new Invoice({
      invoiceNumber,
      mainCategories: categories,
      invoiceType:    isAdvance ? 'ADVANCE' : 'FULL',
      bookingId,
      customer,
      serviceItems,
      subTotal:       amountNum,
      totalAmount:    amountNum,
      paidAmount,
      balanceAmount,
      status:         isAdvance ? 'PARTIAL' : 'PAID',
    });

    await newInvoice.save();
    const payhereData = payhereService.generateCheckoutData(newInvoice);
    res.status(201).json({ invoice: newInvoice, payhere: payhereData });
  } catch (error) {
    console.error('Error creating PayHere checkout:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── handlePayhereIPN ──────────────────────────────────────────────────────
// FIX 1: parseInt(status_code) instead of strict string '2'
// FIX 2: payherePaymentId field used (not non-existent paymentDetails.*)
// FIX 3: emitToUser() for targeted user notifications
// FIX 4: DRAFT used for failed (not non-enum PAYMENT_FAILED)
exports.handlePayhereIPN = async (req, res) => {
  try {
    const { order_id: invoiceNumber, payment_id, status_code, payhere_amount } = req.body;

    if (!payhereService.validateIpnSignature(req.body)) {
      console.error('PayHere IPN: MD5 signature mismatch.');
      return res.status(400).send('Invalid MD5 signature');
    }

    const invoice = await Invoice.findOne({ invoiceNumber });
    if (!invoice) {
      console.error(`PayHere IPN: Invoice not found: ${invoiceNumber}`);
      return res.status(404).send('Invoice not found');
    }

    if (parseInt(status_code) === 2) {
      invoice.status           = 'PAID';
      invoice.paidAmount       = invoice.totalAmount;
      invoice.balanceAmount    = 0;
      invoice.payherePaymentId = payment_id;
      invoice.history.push({
        event:     'PAYMENT_RECEIVED',
        details:   `LKR ${parseFloat(payhere_amount).toFixed(2)} received via PayHere. Payment ID: ${payment_id}`,
        timestamp: new Date(),
      });
      await invoice.save();

      sendPaymentConfirmationEmail(invoice);
      emitEvent('paymentUpdate', { invoiceNumber, status: 'PAID' });
      emitToUser(invoice.customer.userId?.toString(), 'notification', {
        type:      'payment_success',
        title:     'Payment Successful!',
        message:   `Your payment of Rs. ${invoice.totalAmount} for invoice ${invoice.invoiceNumber} was successful.`,
        actionUrl: `/invoice/${invoice.bookingId}`,
      });
    } else {
      invoice.status = 'DRAFT';
      invoice.history.push({
        event:     'PAYMENT_FAILED',
        details:   `PayHere returned status_code ${status_code} for payment ID ${payment_id || 'N/A'}`,
        timestamp: new Date(),
      });
      await invoice.save();
      emitEvent('paymentUpdate', { invoiceNumber, status: 'FAILED' });
      emitToUser(invoice.customer.userId?.toString(), 'notification', {
        type:      'payment_failed',
        title:     'Payment Failed',
        message:   `Your payment for invoice ${invoice.invoiceNumber} failed. Please try again.`,
        actionUrl: `/invoice/${invoice.bookingId}`,
      });
    }

    res.status(200).send('IPN Received');
  } catch (error) {
    console.error('Error processing PayHere IPN:', error.message);
    res.status(500).send('Server Error');
  }
};

exports.handlePayhereReturn = (req, res) => {
  const orderId = req.query.order_id;
  res.redirect(`${process.env.FRONTEND_URL}/invoices/${orderId}?payment_status=returned`);
};

// FIX: PAYMENT_CANCELLED not in enum — use DRAFT
exports.handlePayhereCancel = async (req, res) => {
  const orderId = req.query.order_id;
  try {
    const invoice = await Invoice.findOne({ invoiceNumber: orderId });
    if (invoice && invoice.status !== 'PAID') {
      invoice.status = 'DRAFT';
      invoice.history.push({
        event:     'PAYMENT_CANCELLED',
        details:   'Customer cancelled on PayHere checkout page.',
        timestamp: new Date(),
      });
      await invoice.save();
    }
    res.redirect(`${process.env.FRONTEND_URL}/invoices/${orderId}?payment_status=cancelled`);
  } catch (error) {
    console.error('Error handling PayHere cancel:', error.message);
    res.redirect(`${process.env.FRONTEND_URL}/payment-failed`);
  }
};

// ── getAllInvoices ─────────────────────────────────────────────────────────
exports.getAllInvoices = async (req, res) => {
  try {
    // FIX: Same issue found in getInvoiceByBookingId and sendInvoiceEmail —
    // invoice.bookingId is an ObjectId reference, not a readable string.
    // Every page that lists invoices (Financial Dashboard, Refund workflow,
    // Price Reduction workflow) was showing raw MongoDB ObjectIds like
    // "69e842eb29d76db14dd39b48" instead of "BK-MANUAL-...". Populating
    // here, at the single shared source, fixes it everywhere at once
    // instead of patching each frontend page separately.
    //
    // ALSO FIX: populate date/time/status too — the Invoice schema has no
    // scheduled-service-date field at all, only the linked Booking does.
    // RefundWorkflow's 24-hour cancellation eligibility check was comparing
    // against invoice.createdAt (when the invoice record was made) instead
    // of the actual scheduled service date, making every invoice older
    // than the booking itself permanently "ineligible" for refund — every
    // row showed the "Within 24hrs — not eligible" badge regardless of
    // when the real service was scheduled.
    const invoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .populate('bookingId', 'bookingId date time status');

    const invoicesWithReadableBookingId = invoices.map(inv => {
      const obj = inv.toObject();
      const bookingDoc = inv.bookingId;
      obj.bookingId     = bookingDoc?.bookingId || inv.bookingId;
      obj.serviceDate   = bookingDoc?.date  || null;
      obj.serviceTime   = bookingDoc?.time  || null;
      obj.bookingStatus = bookingDoc?.status || null;
      return obj;
    });

    res.json(invoicesWithReadableBookingId);
  } catch (error) {
    console.error('Error fetching invoices:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── getInvoiceByNumber ────────────────────────────────────────────────────
exports.getInvoiceByNumber = async (req, res) => {
  try {
    // FIX: same readable-bookingId issue — populate before sending so
    // StaffInvoiceViewer shows "BK-MANUAL-..." instead of a raw ObjectId.
    const invoice = await Invoice.findOne({ invoiceNumber: req.params.invoiceNumber })
      .populate('bookingId', 'bookingId');
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });

    const invoiceObj = invoice.toObject();
    invoiceObj.bookingId = invoice.bookingId?.bookingId || invoice.bookingId;

    res.json(invoiceObj);
  } catch (error) {
    console.error('Error fetching invoice:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── getInvoiceById ────────────────────────────────────────────────────────
exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice by ID:', error.message);
    if (error.kind === 'ObjectId') return res.status(404).json({ msg: 'Invoice not found' });
    res.status(500).send('Server Error');
  }
};

// ── getInvoiceByBookingId ─────────────────────────────────────────────────
exports.getInvoiceByBookingId = async (req, res) => {
  try {
    // bookingId on Invoice is now ObjectId ref:'Booking' (master schema).
    // req.params.bookingId is the Booking's MongoDB _id as a string.
    let invoice;
    try {
      invoice = await Invoice.findOne({ bookingId: new (require('mongoose').Types.ObjectId)(req.params.bookingId) })
        .populate('bookingId', 'bookingId'); // FIX: populate so the readable BK- string is available
    } catch {
      // fallback: also try matching the old BK- string format in case migration is pending
      invoice = await Invoice.findOne({ 'customer.bookingRef': req.params.bookingId });
    }
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });

    // FIX: swap the populated ObjectId for its readable bookingId string
    // before sending to the frontend, so the customer never sees a raw
    // MongoDB ObjectId on their invoice.
    const invoiceObj = invoice.toObject();
    invoiceObj.bookingId = invoice.bookingId?.bookingId || invoice.bookingId;

    res.json(invoiceObj);
  } catch (error) {
    console.error('Error fetching invoice by bookingId:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── getInvoicesByUserId ───────────────────────────────────────────────────
exports.getInvoicesByUserId = async (req, res) => {
  try {
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ msg: 'Forbidden: cannot access another user\'s invoices.' });
    }
    const mongoose = require('mongoose');
    const invoices = await Invoice.find({
      'customer.userId': new mongoose.Types.ObjectId(req.params.userId)
    }).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices by userId:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── updateInvoiceStatus ───────────────────────────────────────────────────
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    console.error('Error updating invoice status:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── sendInvoiceEmail ──────────────────────────────────────────────────────
exports.sendInvoiceEmail = async (req, res) => {
  try {
    // FIX: populate the booking reference so the email shows the readable
    // "BK-..." string instead of a raw MongoDB ObjectId. Without populate(),
    // invoice.bookingId is just an ObjectId — meaningless to a customer.
    const invoice = await Invoice.findOne({ invoiceNumber: req.params.invoiceNumber })
      .populate('bookingId', 'bookingId');
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });

    // Build a plain object with the human-readable booking ID swapped in
    // for the email template, without mutating the saved document.
    const invoiceForEmail = invoice.toObject();
    invoiceForEmail.bookingId = invoice.bookingId?.bookingId || invoice.bookingId;

    await sendInvoiceEmail(invoice.customer.email, invoiceForEmail);
    res.json({ msg: `Invoice ${invoice.invoiceNumber} sent to ${invoice.customer.email}` });
  } catch (error) {
    console.error('Error sending invoice email:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── createInvoice (staff manual) ─────────────────────────────────────────
// FIX: Maps pricing.discount → discounts[] array so discounts are actually
//      saved to MongoDB. Previously the discount was displayed on the PDF
//      but silently dropped from the database record.
exports.createInvoice = async (req, res, next) => {
  try {
    const {
      invoiceType, bookingId, customer,
      serviceItems, customizationItems,
      pricing, payment, createdByStaff,
      serviceDate, serviceTime, serviceAddress,
    } = req.body;

    if (!bookingId || !customer || !serviceItems || !pricing) {
      return res.status(400).json({ msg: 'Missing required fields.' });
    }

    const { prefix, categories } = determineInvoiceDetails(serviceItems);
    const invoiceNumber = await generateInvoiceNumber(prefix);

    const discountAmount = parseFloat(pricing.discount || 0);
    const discounts = discountAmount > 0
      ? [{ description: 'Staff discount', amount: discountAmount }]
      : [];

    const subTotal    = parseFloat(pricing.basePrice || 0);
    const totalAmount = parseFloat((subTotal - discountAmount).toFixed(2));
    const paidAmount  = parseFloat(payment?.paidAmount  || 0);
    const balanceAmount = parseFloat((totalAmount - paidAmount).toFixed(2));

    // FIX: bookingId on Invoice is an ObjectId ref:'Booking' — but manual
    // staff invoices (created via StaffInvoicePage) have no real Booking
    // document, only a placeholder string like "BK-MANUAL-...". Saving that
    // string directly fails Mongoose validation with a 500 error.
    //
    // Fix: if bookingId isn't a valid existing Booking, create a minimal
    // Booking document right here so the Invoice can reference a real
    // ObjectId. This also keeps the data model consistent — every invoice
    // always traces back to an actual booking record.
    const mongoose = require('mongoose');
    const User = require('../models/User');
    let bookingObjectId;

    const isValidObjectId = mongoose.Types.ObjectId.isValid(bookingId) &&
      (await Booking.exists({ _id: bookingId }));

    if (isValidObjectId) {
      bookingObjectId = bookingId;
    } else {
      // FIX: Booking.customerId is a REQUIRED ObjectId ref to User.
      // Manual staff invoices have a customer name/email/phone but no real
      // registered User account. Find an existing User by email, or create
      // a lightweight walk-in customer record so the Booking can be saved.
      let customerUser = await User.findOne({ email: customer.email });

      if (!customerUser) {
        const [firstName, ...rest] = (customer.name || 'Walk-in Customer').split(' ');
        customerUser = await User.create({
          firstName:  firstName || 'Walk-in',
          lastName:   rest.join(' ') || 'Customer',
          email:      customer.email,
          phone:      customer.phone || '0000000000',
          // Random unusable password — this is a staff-created walk-in
          // record, not a real login account. They never authenticate.
          password:   require('crypto').randomBytes(16).toString('hex'),
          role:       'customer',
          isVerified: true,
          isActive:   true,
        });
      }

      const newBooking = await Booking.create({
        bookingId:     bookingId, // keep the human-readable BK-... string on the Booking itself
        customerId:    customerUser._id,
        customerName:  customer.name,
        email:         customer.email,
        serviceName:   serviceItems[0]?.name || 'Manual Service',
        serviceItems:  serviceItems.map(i => ({ name: i.name, price: i.price, quantity: i.quantity || 1 })),
        date:          serviceDate || new Date().toISOString().split('T')[0],
        time:          serviceTime || new Date().toLocaleTimeString(),
        address:       serviceAddress || customer.address || 'N/A',
        price:         totalAmount,
        paidAmount,
        balanceAmount,
        status:        payment?.status === 'PAID' ? 'completed' : 'confirmed',
        paymentMethod: payment?.method?.toLowerCase().includes('cod') ? 'cod'
                      : payment?.method?.toLowerCase().includes('cash') ? 'cash' : 'online',
      });
      bookingObjectId = newBooking._id;
    }

    const newInvoice = new Invoice({
      invoiceNumber,
      mainCategories: categories,
      invoiceType:    invoiceType || 'FULL',
      bookingId:      bookingObjectId,
      customer,
      serviceItems,
      customizationItems: customizationItems || [],
      discounts,
      subTotal,
      totalAmount,
      paidAmount,
      balanceAmount:  Math.max(0, balanceAmount),
      // APPROVAL FLOW: Staff-created invoices always start as DRAFT.
      // An admin must approve before the invoice is sent to the customer.
      // PayHere online payments bypass this — their status is set by the IPN webhook.
      status: 'DRAFT',
    });

    await newInvoice.save();

    // Notify admin via Socket.IO (real-time badge update on the dashboard)
    emitEvent('invoiceApprovalNeeded', {
      invoiceId:     newInvoice._id,
      invoiceNumber: newInvoice.invoiceNumber,
      customerName:  customer.name,
      totalAmount,
      createdByStaff,
    });

    // Save a persistent notification to DB so admin sees it even after refresh.
    // Uses ADMIN_USER_ID env var — set this to your admin account's MongoDB _id.
    //
    // FIX: ADMIN_USER_ID can be unset, empty, or still contain the literal
    // placeholder text "<your admin account's MongoDB _id>" if someone
    // forgot to replace it in .env. Previously any non-empty string was
    // passed straight to Notification.create() and Mongoose would throw a
    // validation error trying to cast it to ObjectId — crashing the entire
    // invoice creation even though the invoice itself saved fine.
    // Now: validate it's a real ObjectId first, and never let a notification
    // failure block the actual invoice response.
    const adminUserId = process.env.ADMIN_USER_ID;
    const isValidAdminId = adminUserId && mongoose.Types.ObjectId.isValid(adminUserId);

    if (isValidAdminId) {
      try {
        await Notification.create({
          userId:    adminUserId,
          type:      'invoice-approval',
          title:     'Invoice Awaiting Approval',
          message:   `Invoice ${newInvoice.invoiceNumber} for ${customer.name} (Rs. ${totalAmount.toLocaleString()}) was created by staff and needs your approval.`,
          actionUrl: `/staff-invoice/${newInvoice.invoiceNumber}`,
          bookingId: newInvoice.bookingId,
        });
      } catch (notifErr) {
        // Never let a failed admin notification block the invoice response —
        // the invoice already saved successfully above.
        console.warn('Could not save admin approval notification:', notifErr.message);
      }
    } else if (adminUserId) {
      console.warn(
        `ADMIN_USER_ID in .env is not a valid MongoDB ObjectId: "${adminUserId}". ` +
        `Skipping admin notification. Set a real 24-character hex ID from your users collection.`
      );
    }

    res.status(201).json(newInvoice);
  } catch (error) {
    // FIX: Log the FULL error (including Mongoose validation details) so
    // failures are debuggable instead of a generic "Server Error" string.
    console.error('Error creating invoice:', error.message);
    if (error.errors) {
      console.error('Validation details:', Object.keys(error.errors).map(k => `${k}: ${error.errors[k].message}`).join(' | '));
    }
    next(error); // let the centralised errorHandler format Mongoose validation errors properly
  }
};

// ── approveInvoice ────────────────────────────────────────────────────────
// Admin approves a DRAFT staff-created invoice.
// Changes status DRAFT → SENT and sends the invoice email to the customer.
// @route   POST /api/invoices/:id/approve
// @access  Private (admin)
exports.approveInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found.' });

    if (invoice.status !== 'DRAFT') {
      return res.status(400).json({ msg: `Invoice is already ${invoice.status} — only DRAFT invoices can be approved.` });
    }

    invoice.status = 'SENT';
    invoice.history.push({
      event:     'APPROVED',
      details:   `Invoice approved by admin (user: ${req.user?.id || 'unknown'}). Email sent to customer.`,
      timestamp: new Date(),
    });
    await invoice.save();

    // Send the invoice email to the customer immediately on approval
    await sendInvoiceEmail(invoice.customer.email, invoice);

    // Notify the customer via Socket.IO that their invoice is ready
    emitToUser(invoice.customer.userId?.toString(), 'notification', {
      type:      'order-confirmed',
      title:     'Your Invoice is Ready',
      message:   `Invoice ${invoice.invoiceNumber} for Rs. ${invoice.totalAmount.toLocaleString()} has been issued. Check your email for details.`,
      actionUrl: `/invoice/${invoice.bookingId}`,
    });

    // Real-time dashboard update — removes the DRAFT badge
    emitEvent('invoiceUpdate', invoice);

    res.json({ msg: 'Invoice approved and sent to customer.', invoice });
  } catch (error) {
    console.error('Error approving invoice:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── createCashInvoice ─────────────────────────────────────────────────────
// FIX: status was 'PENDING_CASH' — not in enum. Changed to 'SENT'.
exports.createCashInvoice = async (req, res) => {
  try {
    const { bookingId, serviceType, amount, customer } = req.body;
    if (!bookingId || !serviceType || !amount || !customer) {
      return res.status(400).json({ msg: 'Missing required fields for cash invoice.' });
    }

    const serviceItems  = [{ name: serviceType, price: amount }];
    const { prefix, categories } = determineInvoiceDetails(serviceItems);
    const invoiceNumber = await generateInvoiceNumber(prefix);

    const newInvoice = new Invoice({
      invoiceNumber,
      mainCategories: categories,
      invoiceType:    'COD',
      bookingId,
      customer,
      serviceItems,
      subTotal:       amount,
      totalAmount:    amount,
      paidAmount:     0,
      balanceAmount:  amount,
      status:         'SENT',
    });

    await newInvoice.save();
    res.status(201).json(newInvoice);
  } catch (error) {
    console.error('Error creating cash invoice:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── markAsPaid ────────────────────────────────────────────────────────────
exports.markAsPaid = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });

    invoice.paidAmount    = invoice.totalAmount;
    invoice.balanceAmount = 0;
    invoice.status        = 'PAID';
    invoice.history.push({ event: 'PAYMENT_RECEIVED', details: 'Marked as paid by staff.', timestamp: new Date() });
    // FIX: use validateBeforeSave:false because some legacy invoices have
    // customer.userId and bookingId stored as strings (pre-migration data).
    // We are only updating payment fields so skipping validation is safe here.
    await invoice.save({ validateBeforeSave: false });

    res.json(invoice);
  } catch (error) {
    console.error('Error marking invoice as paid:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── deleteInvoice ─────────────────────────────────────────────────────────
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });
    res.json({ msg: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── generatePaymentLink ───────────────────────────────────────────────────
exports.generatePaymentLink = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });
    if (invoice.balanceAmount <= 0) return res.status(400).json({ msg: 'No outstanding balance on this invoice.' });

    const paymentLink = `${process.env.FRONTEND_URL}/balance-payment?invoiceId=${invoice._id}&balance=${invoice.balanceAmount}`;
    res.json({ paymentLink, balanceAmount: invoice.balanceAmount });
  } catch (error) {
    console.error('Error generating payment link:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── payBalance ────────────────────────────────────────────────────────────
exports.payBalance = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });
    if (invoice.balanceAmount <= 0) return res.status(400).json({ msg: 'No outstanding balance.' });

    const payhereData = payhereService.generateCheckoutData({
      ...invoice.toObject(),
      paidAmount: invoice.balanceAmount,
    });
    res.json({ payhere: payhereData, invoice });
  } catch (error) {
    console.error('Error initiating balance payment:', error.message);
    res.status(500).send('Server Error');
  }
};

// ── getFinancialReport ────────────────────────────────────────────────────
exports.getFinancialReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const query = {};
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate)   query.createdAt.$lte = new Date(toDate + 'T23:59:59');
    }

    const invoices = await Invoice.find(query).sort({ createdAt: -1 });

    const totalInvoiced  = invoices.reduce((s, i) => s + (i.totalAmount  || 0), 0);
    const totalCollected = invoices.reduce((s, i) => s + (i.paidAmount   || 0), 0);
    const totalPending   = invoices.reduce((s, i) => s + (i.balanceAmount || 0), 0);
    const totalRefunded  = invoices.filter(i => i.status === 'REFUNDED').reduce((s, i) => s + (i.totalAmount || 0), 0);

    res.json({
      summary: { totalInvoiced, totalCollected, totalPending, totalRefunded, count: invoices.length },
      invoices,
    });
  } catch (error) {
    console.error('Error generating financial report:', error.message);
    res.status(500).send('Server Error');
  }
};