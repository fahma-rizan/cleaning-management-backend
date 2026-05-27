const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Refund = require('../models/Refund'); // Import the new Refund model
const { 
  sendRefundRequestEmail, 
  sendRefundStatusEmail 
} = require('../utils/emailService');

// @route   GET /api/refunds
// @desc    Get all refund requests (populating invoice details)
// @access  Private (for admin)
router.get('/', async (req, res) => {
  try {
    const refunds = await Refund.find({ status: 'PENDING' })
      .populate({
        path: 'invoice',
        model: 'Invoice',
        // Optionally select fields to populate
        // select: 'invoiceNumber totalAmount customer', 
      })
      .sort({ createdAt: -1 });

    res.json(refunds);
  } catch (error) {
    console.error('Error fetching refund requests:', error.message);
    res.status(500).send('Server Error');
  }
});


// @route   POST /api/refunds/request
// @desc    A customer requests a refund for an invoice
// @access  Private
router.post('/request', async (req, res) => {
  const { invoiceId, reason } = req.body;

  if (!invoiceId || !reason) {
    return res.status(400).json({ msg: 'Invoice ID and reason are required.' });
  }

  try {
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ msg: 'Invoice not found.' });
    }

    // Prevent duplicate refund requests
    const existingRefund = await Refund.findOne({ invoice: invoiceId });
    if (existingRefund) {
      return res.status(400).json({ msg: 'A refund has already been requested for this invoice.' });
    }

    // Update invoice status to show a refund is pending
    invoice.status = 'REFUND_PENDING';
    await invoice.save();

    // Create the new Refund document
    const newRefund = new Refund({
      invoice: invoice._id,
      reason: reason,
      status: 'PENDING',
      refundedAmount: invoice.paidAmount, // The amount to be refunded
    });

    await newRefund.save();

    // --- Notifications ---
    sendRefundRequestEmail(invoice, reason);
    const io = req.app.get('socketio');
    io.emit('refundUpdate', invoice); // Let the dashboard know about the status change

    res.status(201).json(newRefund);
  } catch (error) {
    console.error('Error processing refund request:', error.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/refunds/approve/:refundId
// @desc    Admin approves a refund request
// @access  Private (for admin)
router.post('/approve/:refundId', async (req, res) => {
  try {
    const refund = await Refund.findById(req.params.refundId);

    if (!refund) {
      return res.status(404).json({ msg: 'Refund request not found.' });
    }

    // Update the Refund document
    refund.status = 'APPROVED';
    await refund.save();

    // Update the associated Invoice
    const invoice = await Invoice.findById(refund.invoice);
    if (invoice) {
      invoice.status = 'REFUNDED';
      await invoice.save();
      
      // --- Notifications ---
      sendRefundStatusEmail(invoice, 'approved');
      const io = req.app.get('socketio');
      io.emit('refundUpdate', invoice);
      io.emit('invoiceUpdate', invoice); // Also send a general invoice update
    }

    res.json(refund);
  } catch (error) {
    console.error('Error approving refund:', error.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/refunds/reject/:refundId
// @desc    Admin rejects a refund request
// @access  Private (for admin)
router.post('/reject/:refundId', async (req, res) => {
  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ msg: 'A rejection reason is required.' });
  }

  try {
    const refund = await Refund.findById(req.params.refundId);

    if (!refund) {
      return res.status(404).json({ msg: 'Refund request not found.' });
    }

    // Update the Refund document
    refund.status = 'REJECTED';
    refund.rejectionReason = reason;
    await refund.save();

    // Revert the Invoice status back to PAID
    const invoice = await Invoice.findById(refund.invoice);
    if (invoice) {
      invoice.status = 'PAID'; // Or its previous status if we stored it
      await invoice.save();

      // --- Notifications ---
      sendRefundStatusEmail(invoice, 'rejected', reason);
      const io = req.app.get('socketio');
      io.emit('refundUpdate', invoice);
      io.emit('invoiceUpdate', invoice);
    }

    res.json(refund);
  } catch (error) {
    console.error('Error rejecting refund:', error.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;