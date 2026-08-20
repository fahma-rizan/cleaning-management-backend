const Invoice       = require('../models/Invoice');
const PriceReduction = require('../models/PriceReduction');
const { sendRefundStatusEmail } = require('../utils/emailService');
const { emitEvent, emitToUser } = require('../sockets/socketManager');

// ── Helper: get a fresh PayHere OAuth token ───────────────────────────────
const getPayhereToken = async () => {
  const appId     = process.env.PAYHERE_APP_ID;
  const appSecret = process.env.PAYHERE_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('PAYHERE_APP_ID and PAYHERE_APP_SECRET must be set in .env');
  }
  const authString = Buffer.from(`${appId}:${appSecret}`).toString('base64');
  const res = await fetch(`${process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk'}/merchant/v1/oauth/token`, {
    method:  'POST',
    headers: { Authorization: `Basic ${authString}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error('Failed to get PayHere OAuth token');
  return data.access_token;
};

// @desc    Customer requests a price reduction
// @route   POST /api/price-reductions/request
// @access  Private
exports.requestPriceReduction = async (req, res, next) => {
  try {
    const { invoiceId, requestedAmount, reason } = req.body;

    if (!invoiceId || !requestedAmount || !reason) {
      return res.status(400).json({ msg: 'invoiceId, requestedAmount and reason are required.' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({ msg: `"${invoiceId}" is not a valid invoice ID.` });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found.' });

    // Only paid or partial invoices are eligible
    if (!['PAID', 'PARTIAL'].includes(invoice.status)) {
      return res.status(400).json({ msg: `Price reduction can only be requested for paid or partially paid invoices. This invoice is currently ${invoice.status}.` });
    }

    // Requested amount cannot exceed the invoice total
    if (parseFloat(requestedAmount) >= invoice.totalAmount) {
      return res.status(400).json({ msg: `Requested reduction (Rs. ${requestedAmount}) cannot be equal to or greater than the invoice total (Rs. ${invoice.totalAmount}). For a full refund, please use the Refund page.` });
    }

    // Prevent duplicate pending request
    const existing = await PriceReduction.findOne({ invoice: invoiceId, status: 'PENDING' });
    if (existing) {
      return res.status(400).json({ msg: 'A price reduction request is already pending for this invoice.' });
    }

    const reduction = new PriceReduction({
      invoice: invoice._id,
      requestedAmount: parseFloat(requestedAmount),
      reason,
    });
    await reduction.save();

    invoice.status = 'REFUND_PENDING';
    invoice.history.push({
      event:     'PRICE_REDUCTION_REQUESTED',
      details:   `Customer requested Rs. ${requestedAmount} price reduction. Reason: ${reason}`,
      timestamp: new Date(),
    });
    // FIX: changed to validateBeforeSave: false — some legacy/seed invoices
    // have customer.userId or bookingId stored as plain strings (pre-master-
    // schema data), and a full re-validation on save() throws a Mongoose
    // ValidationError here even though we're only changing status/history.
    // That ValidationError was the actual cause of the 500 — it happened
    // AFTER the PriceReduction document had already been created above,
    // which is also why a retry then hit the "already pending" 400.
    await invoice.save({ validateBeforeSave: false });

    // Notify admin via socket — never let a notification failure break the
    // actual request, which already succeeded by this point.
    try {
      emitEvent('priceReductionRequest', { invoice, reduction });
    } catch (notifyErr) {
      console.warn('Could not emit priceReductionRequest event:', notifyErr.message);
    }

    res.status(201).json(reduction);
  } catch (err) {
    console.error('Error requesting price reduction:', err.message);
    if (err.errors) {
      console.error('Validation details:', Object.keys(err.errors).map(k => `${k}: ${err.errors[k].message}`).join(' | '));
    }
    next(err);
  }
};

// @desc    Get all price reduction requests (admin)
// @route   GET /api/price-reductions
// @access  Private (admin)
exports.getAllReductions = async (req, res) => {
  try {
    const query = req.query.status ? { status: req.query.status.toUpperCase() } : {};
    const reductions = await PriceReduction.find(query)
      .populate({ path: 'invoice', model: 'Invoice' })
      .sort({ createdAt: -1 });
    res.json(reductions);
  } catch (err) {
    console.error('Error fetching price reductions:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Admin approves a price reduction request
// @route   POST /api/price-reductions/approve/:id
// @access  Private (admin)
//
// Logic:
//  - If invoice.paidAmount > 0 (customer already paid some/all):
//      Call PayHere partial refund API for the approvedAmount
//      Reduce invoice.paidAmount and invoice.totalAmount
//  - If invoice.paidAmount === 0 (not paid yet, e.g. COD):
//      Just reduce invoice.totalAmount and invoice.balanceAmount (no PayHere call)
exports.approveReduction = async (req, res, next) => {
  try {
    const { approvedAmount } = req.body;

    if (!approvedAmount || parseFloat(approvedAmount) <= 0) {
      return res.status(400).json({ msg: 'approvedAmount is required and must be greater than 0.' });
    }

    const reduction = await PriceReduction.findById(req.params.id).populate('invoice');
    if (!reduction) return res.status(404).json({ msg: 'Price reduction request not found.' });

    const invoice = reduction.invoice;
    if (!invoice)  return res.status(404).json({ msg: 'Associated invoice not found.' });

    const amount = parseFloat(parseFloat(approvedAmount).toFixed(2));

    if (amount >= invoice.totalAmount) {
      return res.status(400).json({ msg: 'Approved amount must be less than the invoice total. Use the Refund workflow for full refunds.' });
    }

    let reductionType = 'ADJUSTMENT';

    if (invoice.paidAmount > 0 && invoice.payherePaymentId) {
      // Customer paid online via PayHere — issue a partial PayHere refund
      const token = await getPayhereToken();

      const refundRes = await fetch(
        `${process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk'}/merchant/v1/payment/refund`,
        {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            payment_id:  invoice.payherePaymentId,
            description: `Price reduction approved. Reason: ${reduction.reason}`,
            amount,
          }),
        }
      );
      const refundData = await refundRes.json();
      if (!refundRes.ok || refundData.status !== 1) {
        return res.status(502).json({ msg: 'Refund failed at payment gateway.', details: refundData.msg || refundData });
      }

      reductionType = 'REFUND';

      // Reduce both what was paid and the invoice total
      invoice.paidAmount   = parseFloat((invoice.paidAmount   - amount).toFixed(2));
      invoice.totalAmount  = parseFloat((invoice.totalAmount  - amount).toFixed(2));
      invoice.balanceAmount = parseFloat((invoice.totalAmount - invoice.paidAmount).toFixed(2));

    } else if (invoice.paidAmount > 0) {
      // FIX: Customer paid in CASH (no payherePaymentId) — there is no
      // online gateway to call. Previously this hit a hard 400 error and
      // admin could never approve a reduction on a cash-paid invoice at all.
      // Now: record it as a manual cash refund the admin has handled
      // outside the system (e.g. handed cash back), and adjust the
      // invoice's recorded amounts to match.
      reductionType = 'REFUND';
      invoice.paidAmount    = parseFloat((invoice.paidAmount   - amount).toFixed(2));
      invoice.totalAmount   = parseFloat((invoice.totalAmount  - amount).toFixed(2));
      invoice.balanceAmount = parseFloat((invoice.totalAmount  - invoice.paidAmount).toFixed(2));
      invoice.history.push({
        event:     'CASH_REFUND_MANUAL',
        details:   `Rs. ${amount} cash refund recorded manually by admin (no online payment to reverse).`,
        timestamp: new Date(),
      });
    } else {
      // Not paid yet — adjust the balance/total downward
      invoice.totalAmount   = parseFloat((invoice.totalAmount   - amount).toFixed(2));
      invoice.balanceAmount = parseFloat((invoice.balanceAmount - amount).toFixed(2));
    }

    // Add discount entry to invoice discounts array
    invoice.discounts = invoice.discounts || [];
    invoice.discounts.push({ description: `Price reduction: ${reduction.reason}`, amount });

    invoice.status = invoice.paidAmount >= invoice.totalAmount ? 'PAID' : invoice.paidAmount > 0 ? 'PARTIAL' : invoice.status;

    invoice.history.push({
      event:     'PRICE_REDUCED',
      details:   `Rs. ${amount} price reduction approved by admin. Type: ${reductionType}. Reason: ${reduction.reason}`,
      timestamp: new Date(),
    });
    // FIX: skip full re-validation — legacy invoices may have string
    // customer.userId/bookingId that fail ObjectId validation even though
    // we're only updating pricing/status/history fields here.
    await invoice.save({ validateBeforeSave: false });

    // Update reduction record
    reduction.approvedAmount = amount;
    reduction.reductionType  = reductionType;
    reduction.status         = 'APPROVED';
    await reduction.save();

    // Notify customer and send email — never let these fail the approval,
    // which has already succeeded by this point.
    try {
      emitToUser(invoice.customer.userId?.toString(), 'notification', {
        type:      'payment-reduction-approved',
        title:     'Price Reduction Approved',
        message:   `Your price reduction of Rs. ${amount} for invoice ${invoice.invoiceNumber} has been approved.`,
        actionUrl: `/invoice/${invoice.bookingId}`,
      });
      await sendRefundStatusEmail(invoice, 'approved', '', amount);
      emitEvent('priceReductionUpdate', invoice);
      emitEvent('invoiceUpdate', invoice);
    } catch (notifyErr) {
      console.warn('Price reduction approved but notification/email failed:', notifyErr.message);
    }

    res.json({ msg: 'Price reduction approved successfully.', reduction, invoice });
  } catch (err) {
    console.error('Error approving price reduction:', err.message);
    if (err.errors) {
      console.error('Validation details:', Object.keys(err.errors).map(k => `${k}: ${err.errors[k].message}`).join(' | '));
    }
    next(err);
  }
};

// @desc    Admin rejects a price reduction request
// @route   POST /api/price-reductions/reject/:id
// @access  Private (admin)
exports.rejectReduction = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ msg: 'A rejection reason is required.' });

    const reduction = await PriceReduction.findById(req.params.id).populate('invoice');
    if (!reduction) return res.status(404).json({ msg: 'Price reduction request not found.' });

    reduction.status          = 'REJECTED';
    reduction.rejectionReason = reason;
    await reduction.save();

    const invoice = reduction.invoice;
    if (invoice) {
      invoice.status = 'PAID'; // restore previous status
      invoice.history.push({
        event:     'PRICE_REDUCTION_REJECTED',
        details:   `Price reduction rejected by admin. Reason: ${reason}`,
        timestamp: new Date(),
      });
      // FIX: same validateBeforeSave issue as approveReduction — legacy
      // invoices with string customer.userId/bookingId failed full
      // re-validation on a status-only update, causing a 500.
      await invoice.save({ validateBeforeSave: false });

      try {
        emitToUser(invoice.customer.userId?.toString(), 'notification', {
          type:      'complaint-rejected',
          title:     'Price Reduction Request Rejected',
          message:   `Your price reduction request for invoice ${invoice.invoiceNumber} was not approved. Reason: ${reason}`,
          actionUrl: `/invoice/${invoice.bookingId}`,
        });
        emitEvent('priceReductionUpdate', invoice);
      } catch (notifyErr) {
        console.warn('Price reduction rejected but notification failed:', notifyErr.message);
      }
    }

    res.json(reduction);
  } catch (err) {
    console.error('Error rejecting price reduction:', err.message);
    if (err.errors) {
      console.error('Validation details:', Object.keys(err.errors).map(k => `${k}: ${err.errors[k].message}`).join(' | '));
    }
    next(err);
  }
};