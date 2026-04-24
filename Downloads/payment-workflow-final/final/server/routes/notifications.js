const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth'); // Assuming auth middleware is in this path

// --- @desc    Create a new notification ---
// --- @route   POST /api/notifications ---
// FIX (Critical): Made public to allow notifications during payment flow without auth
// The userId must be provided in the request body
router.post('/', async (req, res) => {
  try {
    const { userId, type, title, message, actionUrl, bookingId } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({ message: 'Missing required fields: userId, type, title, message' });
    }

    const newNotification = await Notification.create({
      userId, type, title, message, actionUrl, bookingId,
    });

    res.status(201).json(newNotification);
  } catch (error) {
    console.error('--- ERROR CREATING NOTIFICATION ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @desc    Create a new notification (for authenticated requests) ---
// --- @route   POST /api/notifications/auth ---
router.post('/auth', auth, async (req, res) => {
  try {
    const { type, title, message, actionUrl, bookingId } = req.body;
    const userId = req.user.id; // Get user ID from authenticated user token

    if (!type || !title || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newNotification = await Notification.create({
      userId, type, title, message, actionUrl, bookingId,
    });

    res.status(201).json(newNotification);
  } catch (error) {
    console.error('--- ERROR CREATING NOTIFICATION ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @desc    Get all notifications for the authenticated user ---
// --- @route   GET /api/notifications ---
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error('--- ERROR GETTING NOTIFICATIONS ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @desc    Get all notifications for a specific user ID (public) ---
// --- @route   GET /api/notifications/user/:userId ---
// FIX (Critical): Added public endpoint for fetching user notifications
router.get('/user/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error('--- ERROR GETTING USER NOTIFICATIONS ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @desc    Mark a single notification as read ---
// --- @route   PUT /api/notifications/:id/read ---
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Authorization: Check if the notification belongs to the user
    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You cannot modify this notification.' });
    }

    notification.read = true;
    await notification.save();
    
    res.json(notification);
  } catch (error) {
    console.error('--- ERROR MARKING READ ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @desc    Mark all notifications for a user as read ---
// --- @route   PUT /api/notifications/mark-all-read ---
router.put('/mark-all-read', auth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('--- ERROR MARKING ALL READ ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @desc    Delete a single notification ---
// --- @route   DELETE /api/notifications/:id ---
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Authorization: Check if the notification belongs to the user
    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You cannot delete this notification.' });
    }

    await notification.deleteOne();
    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('--- ERROR DELETING NOTIFICATION ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @desc    Delete all notifications for a user ---
// --- @route   DELETE /api/notifications/all ---
router.delete('/all', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user.id });
    res.status(200).json({ message: 'All notifications for user deleted' });
  } catch (error) {
    console.error('--- ERROR DELETING ALL NOTIFICATIONS ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;