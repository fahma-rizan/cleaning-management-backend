const express    = require('express');
const router     = express.Router();
const nodemailer = require('nodemailer');

// ── Nodemailer transporter (Gmail SMTP) ───────────────────────────────────
// Add GMAIL_USER and GMAIL_PASS to your .env file
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS, // Use an App Password, not your real Gmail password
  },
});

// ── Helper: fill template variables ──────────────────────────────────────
const fillTemplate = (template, variables) => {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
};

// ── Email Templates ───────────────────────────────────────────────────────
const TEMPLATES = {

  'booking-confirmed': {
    subject: 'Your Booking is Confirmed! 🎉 — Cloud Laundry.lk',
    body: (v) => `
Dear ${v.customer_name},

Thank you for choosing Cloud Laundry.lk! Your booking has been confirmed.

📋 BOOKING DETAILS
───────────────────────────────
Booking ID     : ${v.booking_id}
Service        : ${v.service_name}
Date & Time    : ${v.service_date} at ${v.service_time}
Address        : ${v.address}
───────────────────────────────

💳 PAYMENT SUMMARY
Amount Paid    : Rs. ${v.paid_amount}
Balance Due    : Rs. ${v.balance_amount}
Payment Method : ${v.payment_method}

Our team will arrive at your location at the scheduled time.

If you have any questions, call us at +94 11 234 5678.

Warm regards,
Cloud Laundry.lk Team
    `.trim(),
  },

  'payment-received': {
    subject: `Payment Received — Invoice #${'{invoice_number}'} — Cloud Laundry.lk`,
    body: (v) => `
Dear ${v.customer_name},

We have received your payment. Thank you!

🧾 INVOICE SUMMARY
───────────────────────────────
Invoice No.    : ${v.invoice_number}
Booking ID     : ${v.booking_id}
Service        : ${v.service_name}
Amount Paid    : Rs. ${v.paid_amount}
Payment Method : ${v.payment_method}
Date           : ${v.payment_date}
${v.balance_amount > 0 ? `\n⚠️  Balance Remaining: Rs. ${v.balance_amount}\nThe remaining balance will be collected after your service.` : ''}
───────────────────────────────

Thank you for trusting Cloud Laundry.lk!

Best regards,
Cloud Laundry.lk Billing Team
    `.trim(),
  },

  'service-reminder': {
    subject: '🔔 Reminder: Your Service is Tomorrow — Cloud Laundry.lk',
    body: (v) => `
Dear ${v.customer_name},

This is a friendly reminder that your cleaning service is scheduled for tomorrow!

📅 SERVICE DETAILS
───────────────────────────────
Service        : ${v.service_name}
Date           : ${v.service_date}
Time           : ${v.service_time}
Booking ID     : ${v.booking_id}
───────────────────────────────

✅ PREPARATION CHECKLIST
• Ensure someone is home at the scheduled time
• Clear access to the area to be cleaned
• Have your Booking ID ready for reference

Need to reschedule? Call us at +94 11 234 5678 at least 4 hours before.

See you tomorrow!
Cloud Laundry.lk Team
    `.trim(),
  },

  'payment-link': {
    subject: '💳 Payment Link — Your Service is Complete — Cloud Laundry.lk',
    body: (v) => `
Dear ${v.customer_name},

Your ${v.service_name} service has been completed successfully!

Please make your final payment using the link below:

👉 Payment Link: ${v.payment_link}

💳 PAYMENT DETAILS
Amount Due     : Rs. ${v.amount}
Booking ID     : ${v.booking_id}
Due By         : ${v.due_date}

This link is valid for 24 hours.

Thank you for choosing Cloud Laundry.lk!

Best regards,
Cloud Laundry.lk Team
    `.trim(),
  },

  'balance-due': {
    subject: '⚠️ Balance Payment Due — Cloud Laundry.lk',
    body: (v) => `
Dear ${v.customer_name},

Your service has been completed. The remaining balance is now due.

💰 BALANCE DETAILS
───────────────────────────────
Booking ID     : ${v.booking_id}
Service        : ${v.service_name}
Balance Due    : Rs. ${v.balance_amount}
Advance Paid   : Rs. ${v.paid_amount}
───────────────────────────────

Please pay your balance at: ${v.payment_link}

Cloud Laundry.lk Team
    `.trim(),
  },

  'refund-initiated': {
    subject: 'Refund Initiated — Rs. {{refund_amount}} — Cloud Laundry.lk',
    body: (v) => `
Dear ${v.customer_name},

Your refund request has been processed successfully.

💸 REFUND DETAILS
───────────────────────────────
Refund Amount  : Rs. ${v.refund_amount}
Booking ID     : ${v.booking_id}
Reason         : ${v.refund_reason}
Reference No.  : ${v.refund_reference}
───────────────────────────────

${v.is_online === 'true'
  ? '⏳ Your refund will appear in your account within 5–7 business days.'
  : '🏢 Please visit our office to collect your cash refund.\n   Office Hours: Mon–Sat, 9:00 AM – 5:00 PM'}

Cloud Laundry.lk Support Team
📞 +94 11 234 5678
    `.trim(),
  },

  'payment-failed': {
    subject: '⚠️ Payment Failed — Please Try Again — Cloud Laundry.lk',
    body: (v) => `
Dear ${v.customer_name},

Unfortunately, your recent payment attempt failed.

DETAILS
───────────────────────────────
Booking ID     : ${v.booking_id}
Amount         : Rs. ${v.amount}
Reason         : ${v.failure_reason || 'Payment was declined by the provider.'}
───────────────────────────────

Please try the payment again. You can use the link below to retry:
👉 ${v.retry_link}

If you continue to have issues, please contact our support team at +94 11 234 5678.

We apologize for the inconvenience.

Best regards,
Cloud Laundry.lk Team
    `.trim(),
  },
};

// ── @route  POST /api/email/send ──────────────────────────────────────────
// Send a specific email template to a customer
router.post('/send', async (req, res) => {
  try {
    const { templateId, to, variables } = req.body;

    if (!templateId || !to) {
      return res.status(400).json({ message: 'templateId and to (email) are required' });
    }

    const template = TEMPLATES[templateId];
    if (!template) {
      return res.status(404).json({ message: `Template '${templateId}' not found` });
    }

    const subject = typeof template.subject === 'function'
      ? template.subject(variables)
      : fillTemplate(template.subject, variables);

    const text = template.body(variables || {});

    await transporter.sendMail({
      from: `"Cloud Laundry.lk" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
    });

    console.log(`Email sent: ${templateId} → ${to}`);
    res.status(200).json({ message: 'Email sent successfully', templateId, to });

  } catch (error) {
    console.error('Error sending email:', error.message);
    res.status(500).json({ message: 'Failed to send email', error: error.message });
  }
});

// ── @route  POST /api/email/payment-link ─────────────────────────────────
// Send payment link after service completion (pay-after-completion flow)
router.post('/payment-link', async (req, res) => {
  try {
    const { to, customerName, bookingId, serviceType, amount, dueDate } = req.body;

    if (!to || !bookingId || !amount) {
      return res.status(400).json({ message: 'to, bookingId and amount are required' });
    }

    // Generate payment link URL
    const paymentLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-link?bookingId=${bookingId}&amount=${amount}`;

    const variables = {
      customer_name: customerName || 'Customer',
      service_name: serviceType || 'Cleaning Service',
      booking_id: bookingId,
      amount: amount.toLocaleString(),
      payment_link: paymentLink,
      due_date: dueDate || 'Within 24 hours',
    };

    const { body } = TEMPLATES['payment-link'];
    await transporter.sendMail({
      from: `"Cloud Laundry.lk" <${process.env.GMAIL_USER}>`,
      to,
      subject: '💳 Payment Link — Your Service is Complete — Cloud Laundry.lk',
      text: body(variables),
    });

    console.log(`Payment link email sent to ${to} for booking ${bookingId}`);
    res.status(200).json({ message: 'Payment link email sent', paymentLink });

  } catch (error) {
    console.error('Error sending payment link email:', error.message);
    res.status(500).json({ message: 'Failed to send payment link', error: error.message });
  }
});

// ── @route  GET /api/email/templates ──────────────────────────────────────────
// Get a list of all available email templates and their required variables
router.get('/templates', (req, res) => {
  try {
    const templateList = Object.keys(TEMPLATES).map(id => {
      const template = TEMPLATES[id];
      const bodyString = template.body.toString();
      
      // Extract variable names from the template body function (e.g., v.customer_name -> customer_name)
      const variables = [...bodyString.matchAll(/v\.(\w+)/g)].map(match => match[1]);
      const uniqueVariables = [...new Set(variables)]; // Remove duplicates

      return {
        id,
        subject: typeof template.subject === 'function' ? template.subject({}) : template.subject,
        variables: uniqueVariables,
      };
    });
    res.status(200).json(templateList);
  } catch (error) {
    console.error('Error fetching templates:', error.message);
    res.status(500).json({ message: 'Failed to fetch templates', error: error.message });
  }
});

module.exports = router;

// ── @route  POST /api/email/balance-reminder ──────────────────────────────
// Send balance payment reminder (advance+balance flow)
router.post('/balance-reminder', async (req, res) => {
  try {
    const { to, customerName, bookingId, serviceType, balanceAmount, paidAmount } = req.body;

    if (!to || !bookingId || !balanceAmount) {
      return res.status(400).json({ message: 'to, bookingId and balanceAmount are required' });
    }

    const paymentLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/balance-payment?bookingId=${bookingId}&balance=${balanceAmount}`;

    const variables = {
      customer_name: customerName || 'Customer',
      service_name: serviceType || 'Cleaning Service',
      booking_id: bookingId,
      balance_amount: balanceAmount.toLocaleString(),
      paid_amount: paidAmount.toLocaleString(),
      payment_link: paymentLink,
    };

    const { body } = TEMPLATES['balance-due'];
    await transporter.sendMail({
      from: `"Cloud Laundry.lk" <${process.env.GMAIL_USER}>`,
      to,
      subject: '⚠️ Balance Payment Due — Cloud Laundry.lk',
      text: body(variables),
    });

    res.status(200).json({ message: 'Balance reminder email sent', paymentLink });

  } catch (error) {
    console.error('Error sending balance reminder:', error.message);
    res.status(500).json({ message: 'Failed to send balance reminder', error: error.message });
  }
});

// ── @route  GET /api/email/templates ─────────────────────────────────────
// List all available template IDs
router.get('/templates', (req, res) => {
  res.json({
    templates: Object.keys(TEMPLATES),
    count: Object.keys(TEMPLATES).length,
  });
});

module.exports = router;