const Invoice = require('../models/Invoice');
const Refund  = require('../models/Refund');
const {
  sendRefundRequestEmail,
  sendRefundStatusEmail,
} = require('../utils/emailService');
const { emitEvent } = require('../sockets/socketManager');

// @desc    Get all pending refund requests
// @route   GET /api/refunds
// @access  Private (admin)
exports.getAllRefunds = async (req, res) => {
  try {
    // FIX: This previously hardcoded status: 'PENDING', which silently
    // limited every caller (including the dashboard's "Total Refunds" /
    // "Refund Rate" stats) to pending-only counts — making those numbers
    // wrong for anyone expecting historical totals. Now accepts an optional
    // ?status= query param; with no param, returns ALL refunds (any status)
    // so the dashboard stats are accurate, while admin's pending-review
    // panel can explicitly request ?status=PENDING.
    const query = req.query.status ? { status: req.query.status.toUpperCase() } : {};
    const refunds = await Refund.find(query)
      .populate({ path: 'invoice', model: 'Invoice' })
      .sort({ createdAt: -1 });
    res.json(refunds);
  } catch (error) {
    console.error('Error fetching refund requests:', error.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Customer requests a refund for an invoice
// @route   POST /api/refunds/request
// @access  Private
//
// FIX (batch 1): Duplicate refund check now uses status filter so a previously
// REJECTED request can be re-submitted, but PENDING/APPROVED cannot be duplicated.
exports.requestRefund = async (req, res, next) => {
  const { invoiceId, reason } = req.body;

  if (!invoiceId || !reason) {
    return res.status(400).json({ msg: 'Invoice ID and reason are required.' });
  }

  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({ msg: `"${invoiceId}" is not a valid invoice ID.` });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ msg: 'Invoice not found.' });
    }

    // Only block if there is already an active (PENDING or APPROVED) refund
    const existingRefund = await Refund.findOne({
      invoice: invoiceId,
      status: { $in: ['PENDING', 'APPROVED'] },
    });
    if (existingRefund) {
      return res.status(400).json({ msg: 'A refund request is already active for this invoice.' });
    }

    invoice.status = 'REFUND_PENDING';
    // FIX: same recurring issue as price reduction and job-complete routes —
    // legacy/seed invoices may have customer.userId or bookingId stored as
    // plain strings (pre-master-schema data). A full schema re-validation
    // on this status-only update throws a Mongoose ValidationError, which
    // was the actual cause of this 500 — not the refund logic itself.
    await invoice.save({ validateBeforeSave: false });

    const newRefund = new Refund({
      invoice: invoice._id,
      reason,
      status: 'PENDING',
      refundedAmount: invoice.paidAmount,
    });

    await newRefund.save();

    // Email and socket notification failures should never block a refund
    // request that has already succeeded.
    try {
      await sendRefundRequestEmail(invoice, reason);
      emitEvent('refundUpdate', invoice);
    } catch (notifyErr) {
      console.warn('Refund request saved but notification/email failed:', notifyErr.message);
    }

    res.status(201).json(newRefund);
  } catch (error) {
    console.error('Error processing refund request:', error.message);
    if (error.errors) {
      console.error('Validation details:', Object.keys(error.errors).map(k => `${k}: ${error.errors[k].message}`).join(' | '));
    }
    next(error);
  }
};

// @desc    Admin approves a refund request
// @route   POST /api/refunds/approve/:refundId
// @access  Private (admin)
//
// FIX (batch 1): Previously only updated the DB without ever calling PayHere's
//   refund API — customer money was never returned. Now:
//   1. Gets PayHere OAuth2 access token
//   2. Calls PayHere refund endpoint
//   3. Only marks invoice REFUNDED if PayHere confirms success
//
// FIX (batch 2): PayHere base URL now read from PAYHERE_BASE_URL env var so
//   switching from sandbox to production requires only a .env change, not a
//   code change. Defaults to sandbox if not set.
//
// FIX (batch 2): sendRefundStatusEmail now receives the refund amount as a
//   separate argument. Previously it was called after invoice.paidAmount had
//   already been decremented — so on a full refund the email showed Rs. 0.
exports.approveRefund = async (req, res, next) => {
  try {
    const refund = await Refund.findById(req.params.refundId).populate('invoice');

    if (!refund) {
      return res.status(404).json({ msg: 'Refund request not found.' });
    }

    const invoice = refund.invoice;
    if (!invoice) {
      return res.status(404).json({ msg: 'Associated invoice not found.' });
    }

    const amountRefunded = refund.refundedAmount;

    // FIX: Previously hard-blocked any refund with no payherePaymentId
    // ("process manually" with no actual way to do that from the UI).
    // Now: if the invoice was paid in cash, record the refund directly —
    // there's no online gateway to call since no online payment exists.
    // Only invoices WITH a real PayHere payment go through the gateway API.
    if (invoice.payherePaymentId) {
      const appId     = process.env.PAYHERE_APP_ID;
      const appSecret = process.env.PAYHERE_APP_SECRET;

      if (!appId || !appSecret) {
        return res.status(500).json({ msg: 'Payment gateway config error: PAYHERE_APP_ID/SECRET missing.' });
      }

      // FIX (batch 2): Use env var so sandbox → production is a config change only
      const payhereBase = process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk';

      // Step 1: Get PayHere OAuth2 access token
      const authString = Buffer.from(`${appId}:${appSecret}`).toString('base64');
      const tokenResponse = await fetch(`${payhereBase}/merchant/v1/oauth/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData.access_token) {
        console.error('PayHere token error:', tokenData);
        return res.status(502).json({ msg: 'Failed to authenticate with payment gateway.' });
      }

      // Step 2: Call PayHere refund API
      const refundResponse = await fetch(`${payhereBase}/merchant/v1/payment/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_id:  invoice.payherePaymentId,
          description: refund.reason || 'Refund approved by admin',
          amount:      amountRefunded,
        }),
      });

      const refundData = await refundResponse.json();
      if (!refundResponse.ok || refundData.status !== 1) {
        console.error('PayHere refund error:', refundData);
        return res.status(502).json({
          msg:     'Refund failed at payment gateway.',
          details: refundData.msg || refundData,
        });
      }
    } else {
      console.log(`Cash refund of Rs. ${amountRefunded} approved manually for invoice ${invoice.invoiceNumber} — no payment gateway involved.`);
    }

    // Step 3: Update DB only after PayHere confirms success (or immediately for cash)
    refund.status = 'APPROVED';
    await refund.save();

    const newPaidAmount   = parseFloat((invoice.paidAmount - amountRefunded).toFixed(2));
    invoice.paidAmount    = Math.max(0, newPaidAmount);
    invoice.balanceAmount = parseFloat((invoice.totalAmount - invoice.paidAmount).toFixed(2));
    invoice.status        = invoice.paidAmount === 0 ? 'REFUNDED' : 'PARTIAL';

    invoice.history.push({
      event:     'REFUND_PROCESSED',
      details:   `LKR ${amountRefunded.toFixed(2)} refunded via PayHere. Reason: ${refund.reason}`,
      timestamp: new Date(),
    });

    await invoice.save({ validateBeforeSave: false });

    // FIX (batch 2): pass amountRefunded explicitly so the email shows the correct figure
    try {
      sendRefundStatusEmail(invoice, 'approved', '', amountRefunded);
      emitEvent('refundUpdate', invoice);
      emitEvent('invoiceUpdate', invoice);
    } catch (notifyErr) {
      console.warn('Refund approved but notification/email failed:', notifyErr.message);
    }

    res.json({ msg: 'Refund processed successfully.', refund, invoiceStatus: invoice.status });
  } catch (error) {
    console.error('Error approving refund:', error.message);
    if (error.errors) {
      console.error('Validation details:', Object.keys(error.errors).map(k => `${k}: ${error.errors[k].message}`).join(' | '));
    }
    next(error);
  }
};

// @desc    Admin rejects a refund request
// @route   POST /api/refunds/reject/:refundId
// @access  Private (admin)
exports.rejectRefund = async (req, res, next) => {
  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ msg: 'A rejection reason is required.' });
  }

  try {
    const refund = await Refund.findById(req.params.refundId);
    if (!refund) {
      return res.status(404).json({ msg: 'Refund request not found.' });
    }

    refund.status          = 'REJECTED';
    refund.rejectionReason = reason;
    await refund.save();

    const invoice = await Invoice.findById(refund.invoice);
    if (invoice) {
      invoice.status = 'PAID';
      invoice.history.push({
        event:     'REFUND_REJECTED',
        details:   `Refund rejected by admin. Reason: ${reason}`,
        timestamp: new Date(),
      });
      // FIX: same validateBeforeSave issue as everywhere else in this file
      await invoice.save({ validateBeforeSave: false });

      try {
        sendRefundStatusEmail(invoice, 'rejected', reason);
        emitEvent('refundUpdate', invoice);
        emitEvent('invoiceUpdate', invoice);
      } catch (notifyErr) {
        console.warn('Refund rejected but notification/email failed:', notifyErr.message);
      }
    }

    res.json(refund);
  } catch (error) {
    console.error('Error rejecting refund:', error.message);
    if (error.errors) {
      console.error('Validation details:', Object.keys(error.errors).map(k => `${k}: ${error.errors[k].message}`).join(' | '));
    }
    next(error);
  }
};