import express    from 'express';
import cors       from 'cors';
import dotenv     from 'dotenv';
import path       from 'path';
dotenv.config();

import { connectDB }  from './config/database';
import { startScheduler } from './config/scheduler';
import adminRoutes    from './routes/admins';
import staffRoutes   from './routes/staff';
import customerRoutes   from './routes/customers';
import reviewRoutes       from './routes/reviews';
import complaintRoutes    from './routes/complaints';
import overviewRoutes     from './routes/overview';
import reportsRoutes      from './routes/reports';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/admins', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reviews',    reviewRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/overview', overviewRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/', (req, res) => res.json({ message: 'CloudLaundry API running' }));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  startScheduler();
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});