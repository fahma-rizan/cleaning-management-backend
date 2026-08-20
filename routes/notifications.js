const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE ORDER MATTERS — literal routes MUST come before dynamic /:id routes.
// Express matches top-to-bottom. If /:id is above /mark-all-read, then
// "mark-all-read" is treated as the id param and the route never fires.
// FIX: All literal/named routes are now defined BEFORE /:id routes.
// ─────────────────────────────────────────────────────────────────────────────

// --- @route   POST /api/notifications ---
// @desc    Create a notification for the authenticated user
// @access  Private
//
// FIX: Removed the public POST / route that accepted userId from the request
// body — any unauthenticated caller could spam any user's inbox. The userId
// now always comes from req.user.id (the verified JWT payload).
router.post('/', auth, async (req, res) => {
  try {
    const { type, title, message, actionUrl, bookingId } = req.body;
    const userId = req.user.id;

    if (!type || !title || !message) {
      return res.status(400).json({ message: 'Missing required fields: type, title, message' });
    }

    const newNotification = await Notification.create({
      userId, type, title, message, actionUrl, bookingId,
    });

    res.status(201).json(newNotification);
  } catch (error) {
    console.error('--- ERROR CREATING NOTIFICATION ---', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @route   GET /api/notifications ---
// @desc    Get all notifications for the authenticated user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error('--- ERROR GETTING NOTIFICATIONS ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @route   PUT /api/notifications/mark-all-read ---
// @desc    Mark all notifications for the authenticated user as read
// @access  Private
//
// FIX: Moved ABOVE /:id/read. Previously Express was matching "mark-all-read"
// as the :id param value, so this route could never be reached.
router.put('/mark-all-read', auth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('--- ERROR MARKING ALL READ ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @route   DELETE /api/notifications/all ---
// @desc    Delete all notifications for the authenticated user
// @access  Private
//
// FIX: Moved ABOVE /:id. Previously Express matched "all" as the :id param,
// so this route was also unreachable.
router.delete('/all', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user.id });
    res.status(200).json({ message: 'All notifications deleted' });
  } catch (error) {
    console.error('--- ERROR DELETING ALL NOTIFICATIONS ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @route   GET /api/notifications/user/:userId ---
// @desc    Get all notifications for a specific user
// @access  Private
//
// FIX: Added auth middleware and ownership check. Previously this was fully
// public — any unauthenticated request could read any user's notifications
// (payment amounts, booking IDs, refund statuses) by guessing their userId.
router.get('/user/:userId', auth, async (req, res) => {
  try {
    // Ensure the requesting user can only see their own notifications
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You cannot access another user\'s notifications.' });
    }

    const notifications = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error('--- ERROR GETTING USER NOTIFICATIONS ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- @route   PUT /api/notifications/:id/read ---
// @desc    Mark a single notification as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (String(notification.userId) !== String(req.user.id)) {
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

// --- @route   DELETE /api/notifications/:id ---
// @desc    Delete a single notification
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (String(notification.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden: You cannot delete this notification.' });
    }

    await notification.deleteOne();
    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('--- ERROR DELETING NOTIFICATION ---', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;