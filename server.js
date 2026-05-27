const express   = require('express');
const cors      = require('cors');
const dotenv    = require('dotenv');
const mongoose  = require('mongoose');
const path      = require('path');
const http      = require('http');
const { Server }= require('socket.io');

dotenv.config();

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI is not set in .env file');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully!');
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

connectDB();

const app  = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3006"], // Allow all possible frontend ports
    methods: ["GET", "POST"]
  }
});

// Make the io instance available to all routes
app.set('socketio', io);

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ── API Routes ────────────────────────────────────────────────────────────
const notificationRoutes  = require('./routes/notifications');
const invoiceRoutes       = require('./routes/invoice');
const refundRoutes        = require('./routes/refund');
const paymentReportRoutes = require('./routes/paymentReport');
const emailRoutes         = require('./routes/email');            // NEW — Nodemailer
const bookingRoutes       = require('./routes/booking');
const analyticsRoutes     = require('./routes/analytics');        // NEW — Analytics
const paymentReminderRoutes = require('./routes/paymentReminders'); // NEW — Payment Reminders
const payhereRoutes = require('./routes/payhere');
const errorHandler = require('./middleware/errorHandler');

app.use('/api/notifications',    notificationRoutes);
app.use('/api/invoices',         invoiceRoutes);
app.use('/api/refunds',          refundRoutes);
app.use('/api/payment-report',   paymentReportRoutes);
app.use('/api/email',            emailRoutes);           // NEW — Nodemailer
app.use('/api/bookings',         bookingRoutes);
app.use('/api/analytics',        analyticsRoutes);       // NEW — Analytics
app.use('/api/payment-reminders', paymentReminderRoutes); // NEW — Payment Reminders
app.use('/api/payhere', payhereRoutes);
app.use(errorHandler); // --- Centralized Error Handling ---

// --- Socket.IO Connection ---
// Authentication middleware for Socket.IO
io.use((socket, next) => {
  // In production, verify JWT from socket.handshake.auth.token
  // For now, allow all connections with optional userId and userRole
  const { userId, userRole } = socket.handshake.auth || {};
  if (userId) {
    socket.userId = userId;
    console.log(`[Socket.IO] User ${userId} connecting as socket ${socket.id}`);
  }
  if (userRole) {
    socket.userRole = userRole;
  }
  next();
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] A user connected: ${socket.id}`);

  // Join user-specific room if userId is provided
  if (socket.userId) {
    socket.join(`user:${socket.userId}`);
    console.log(`[Socket.IO] User ${socket.userId} joined personal room`);
  }

  // If the user is an admin, join the admin-room
  if (socket.userRole === 'admin') {
    socket.join('admin-room');
    console.log(`[Socket.IO] Admin user ${socket.id} joined admin-room`);
  }

  // Handle payment status updates
  socket.on('payment:status', (data) => {
    console.log(`[Socket.IO] Payment status update:`, data);
    // Broadcast to relevant users/admins
    io.emit('payment:status:update', {
      ...data,
      timestamp: new Date().toISOString()
    });
  });

  // Handle booking updates
  socket.on('booking:update', (data) => {
    console.log(`[Socket.IO] Booking update:`, data);
    // Notify relevant users
    if (data.userId) {
      socket.to(`user:${data.userId}`).emit('booking:updated', data);
    }
  });

  // Handle notification read status
  socket.on('notification:read', (data) => {
    console.log(`[Socket.IO] Notification marked as read:`, data);
    // Broadcast to other user devices
    if (data.userId) {
      socket.to(`user:${data.userId}`).emit('notification:read', data);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] User disconnected: ${socket.id}`);
    if (socket.userId) {
      socket.leave(`user:${socket.userId}`);
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`[Socket.IO] Socket error for ${socket.id}:`, error);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});