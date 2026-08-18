const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth',               require('./routes/authRoutes'));
app.use('/api/bookings',           require('./routes/bookingRoutes'));
app.use('/api/staff',              require('./routes/staffRoutes'));
app.use('/api/loyalty',            require('./routes/loyaltyRoutes'));
app.use('/api/inventory/stock',    require('./routes/stockRoutes'));      // must be before /api/inventory
app.use('/api/inventory',          require('./routes/inventoryRoutes'));
app.use('/api/users',              require('./routes/userRoutes'));
app.use('/api/material-requests',  require('./routes/materialRequestRoutes'));
app.use('/api/completion-reports', require('./routes/completionReportRoutes'));
app.use('/api/alerts',             require('./routes/alertRoutes'));
app.use('/api/consumption-rates',  require('./routes/consumptionRateRoutes'));
app.use('/api/reports',            require('./routes/reportRoutes'));
app.use('/api/addresses',          require('./routes/addressRoutes'));

// Loyalty points annual reset cron (Dec 31 midnight)
require('./utils/loyalty.cron');

// Health check - open this in browser to confirm server is working
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Cloud Laundry Backend is running!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});
