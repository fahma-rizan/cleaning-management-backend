const nodemailer = require('nodemailer');

// Email failure logging utility
const logEmailFailure = (context, recipient, error, metadata = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    context,
    recipient,
    error: error.message || String(error),
    errorCode: error.code || 'UNKNOWN',
    ...metadata
  };

  // Log to console with clear formatting
  console.error('='.repeat(60));
  console.error('EMAIL FAILURE LOG');
  console.error('-'.repeat(60));
  console.error(JSON.stringify(logEntry, null, 2));
  console.error('='.repeat(60));

  // In production, you might also want to:
  // 1. Store in a database for monitoring
  // 2. Send to an error tracking service (Sentry, etc.)
  // 3. Alert admins via Slack/other channels

  return logEntry;
};

// Email success logging utility
const logEmailSuccess = (context, recipient, metadata = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[EMAIL SUCCESS] ${timestamp} - ${context} - Sent to: ${recipient}`, metadata);
};

// --------------------------------------------------------------------------
// 1. CREATE THE TRANSPORTER
// --------------------------------------------------------------------------
// This is the object that will actually send the emails.
// We configure it to use Gmail and authenticate with the credentials from our .env file.
//
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail address from .env
    pass: process.env.GMAIL_PASS, // Your App Password from .env
  },
});

// --------------------------------------------------------------------------
// 2. VERIFY THE CONNECTION
// --------------------------------------------------------------------------
// It's a good practice to verify that the transporter is ready to send emails.
// This will try to log in to your Gmail account. You'll see the result in the console.
//
transporter.verify((error, success) => {
  if (error) {
    logEmailFailure('transporter-verify', 'N/A', error, { success: false });
    console.log('-------------------------------------------------');
    console.log('HINT: Is GMAIL_USER and GMAIL_PASS set in your .env file?');
    console.log('For GMAIL_PASS, you must use a Google App Password, not your regular password.');
    console.log('-------------------------------------------------');
  } else {
    console.log('Email transporter is ready to send emails.');
  }
});

// --------------------------------------------------------------------------
// 3. CREATE EMAIL SENDING FUNCTIONS
// --------------------------------------------------------------------------

/**
 * Sends a payment confirmation email to the user.
 * @param {object} invoice - The invoice object from the database.
 */
const sendPaymentConfirmationEmail = async (invoice) => {
  if (!process.env.GMAIL_USER) {
    console.warn('[EMAIL] Email not configured - skipping payment confirmation');
    return;
  }

  const mailOptions = {
    from: `"Your Company Name" <${process.env.GMAIL_USER}>`,
    to: invoice.customer.email, // The customer's email address
    subject: `Payment Confirmation - Invoice #${invoice.invoiceNumber}`,
    html: `
      <h1>Thank you for your payment!</h1>
      <p>Hello ${invoice.customer.name},</p>
      <p>We have successfully received your payment of <strong>Rs. ${invoice.paidAmount.toLocaleString()}</strong> for invoice #${invoice.invoiceNumber}.</p>
      <p>You can view your booking details here: <a href="${process.env.FRONTEND_URL}/bookings/${invoice.bookingId}">View Booking</a></p>
      <p>Thank you for choosing our service!</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logEmailSuccess('payment-confirmation', invoice.customer.email, {
      invoiceNumber: invoice.invoiceNumber,
      bookingId: invoice.bookingId,
      amount: invoice.paidAmount
    });
  } catch (error) {
    logEmailFailure('payment-confirmation', invoice.customer.email, error, {
      invoiceNumber: invoice.invoiceNumber,
      bookingId: invoice.bookingId
    });
  }
};

/**
 * Sends an email to the admin when a refund is requested.
 * @param {object} invoice - The invoice object from the database.
 * @param {string} reason - The reason for the refund request.
 */
const sendRefundRequestEmail = async (invoice, reason) => {
  if (!process.env.GMAIL_USER) {
    console.warn('[EMAIL] Email not configured - skipping refund request notification');
    return;
  }

  const mailOptions = {
    from: `"System Notification" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER, // Send to admin
    subject: `New Refund Request - Invoice #${invoice.invoiceNumber}`,
    html: `
      <h1>New Refund Request</h1>
      <p>A refund has been requested for invoice <strong>#${invoice.invoiceNumber}</strong>.</p>
      <ul>
        <li>Customer: ${invoice.customer.name} (${invoice.customer.email})</li>
        <li>Amount Paid: Rs. ${invoice.paidAmount.toLocaleString()}</li>
        <li>Reason: ${reason}</li>
      </ul>
      <p>Please review this request in the admin dashboard.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logEmailSuccess('refund-request', process.env.GMAIL_USER, {
      invoiceNumber: invoice.invoiceNumber,
      reason: reason
    });
  } catch (error) {
    logEmailFailure('refund-request', process.env.GMAIL_USER, error, {
      invoiceNumber: invoice.invoiceNumber
    });
  }
};

/**
 * Sends an email to the user about the status of their refund.
 * @param {object} invoice - The invoice object from the database.
 * @param {string} status - 'approved' or 'rejected'.
 * @param {string} [rejectionReason] - The reason for rejection (if applicable).
 */
const sendRefundStatusEmail = async (invoice, status, rejectionReason = '') => {
  if (!process.env.GMAIL_USER) {
    console.warn('[EMAIL] Email not configured - skipping refund status email');
    return;
  }

  const subject = status === 'approved' ? 'Your Refund Has Been Approved' : 'Your Refund Request Status';
  const html = status === 'approved' ? `
    <h1>Refund Approved</h1>
    <p>Hello ${invoice.customer.name},</p>
    <p>Your refund request for invoice <strong>#${invoice.invoiceNumber}</strong> has been approved.</p>
    <p>The amount of Rs. ${invoice.paidAmount.toLocaleString()} will be processed back to your original payment method within 5-7 business days.</p>
  ` : `
    <h1>Refund Request Rejected</h1>
    <p>Hello ${invoice.customer.name},</p>
    <p>We're sorry, but your refund request for invoice <strong>#${invoice.invoiceNumber}</strong> has been rejected.</p>
    <p><strong>Reason:</strong> ${rejectionReason}</p>
    <p>If you have any questions, please contact our support team.</p>
  `;

  const mailOptions = {
    from: `"Your Company Name" <${process.env.GMAIL_USER}>`,
    to: invoice.customer.email,
    subject: subject,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    logEmailSuccess('refund-status', invoice.customer.email, {
      invoiceNumber: invoice.invoiceNumber,
      status: status,
      rejectionReason: rejectionReason
    });
  } catch (error) {
    logEmailFailure('refund-status', invoice.customer.email, error, {
      invoiceNumber: invoice.invoiceNumber,
      status: status
    });
  }
};


module.exports = {
  sendPaymentConfirmationEmail,
  sendRefundRequestEmail,
  sendRefundStatusEmail,
};