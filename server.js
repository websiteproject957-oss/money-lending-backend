require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const customerRoutes = require('./routes/customers');
const loanRoutes = require('./routes/loans');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');

const app = express();

// Middleware
app.use(cors({
  origin: ['https://moneylendingsystem.netlify.app', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Connect to DB
connectDB();

// Routes
app.use('/', customerRoutes);
app.use('/', loanRoutes);
app.use('/', paymentRoutes);
app.use('/', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Main handler for POST
// Routing based on action
app.post('/', async (req, res) => {
  const { action } = req.body;
  
  if (!action) {
    return res.status(400).json({ error: 'action is required' });
  }
  
  // Forward to correct route based on action
  req.url = `/${action}`;
  req.method = 'POST';
  app._router.handle(req, res, () => {
    res.status(404).json({ error: 'action not found' });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
