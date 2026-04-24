const express = require('express');
const router = express.Router();
const PaymentReminder = require('../models/PaymentReminder');

// Get payment reminders for an invoice
router.get('/', async (req, res) => {
  try {
    const { invoiceId, type } = req.query;
    const query = {};

    if (invoiceId) query.invoiceId = invoiceId;
    if (type) query.reminderType = type;

    const reminders = await PaymentReminder.find(query)
      .sort({ sentAt: -1 })
      .limit(50);

    res.json(reminders);
  } catch (error) {
    console.error('Error fetching payment reminders:', error);
    res.status(500).json({ error: 'Failed to fetch payment reminders' });
  }
});

// Create a new payment reminder log
router.post('/', async (req, res) => {
  try {
    const reminderData = req.body;
    const reminder = new PaymentReminder(reminderData);
    await reminder.save();

    res.status(201).json(reminder);
  } catch (error) {
    console.error('Error creating payment reminder:', error);
    res.status(500).json({ error: 'Failed to create payment reminder' });
  }
});

// Get reminder statistics
router.get('/stats', async (req, res) => {
  try {
    const { range = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    const ranges = {
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    };
    const startDate = ranges[range] || ranges['30d'];

    const stats = await PaymentReminder.aggregate([
      {
        $match: {
          sentAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$reminderType',
          count: { $sum: 1 },
          sent: {
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      }
    ]);

    const summary = {
      total: stats.reduce((sum, stat) => sum + stat.count, 0),
      sent: stats.reduce((sum, stat) => sum + stat.sent, 0),
      failed: stats.reduce((sum, stat) => sum + stat.failed, 0),
      byType: stats.reduce((acc, stat) => {
        acc[stat._id] = {
          total: stat.count,
          sent: stat.sent,
          failed: stat.failed
        };
        return acc;
      }, {})
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching reminder stats:', error);
    res.status(500).json({ error: 'Failed to fetch reminder statistics' });
  }
});

module.exports = router;