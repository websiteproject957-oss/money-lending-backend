const express = require('express');
const Customer = require('../models/Customer');
const Loan = require('../models/Loan');

const router = express.Router();

// Store active client subscriptions in memory
const clientSubscriptions = new Map();

// Get notifications (appointments)
router.post('/getNotifications', async (req, res) => {
  try {
    const today = new Date();
    const customers = await Customer.find({
      appointment_date: { $ne: '' }
    }).lean();

    const notifications = customers
      .map(customer => {
        if (!customer.appointment_date) return null;

        const apptDate = new Date(customer.appointment_date);
        const daysUntil = Math.ceil((apptDate - today) / (1000 * 60 * 60 * 24));
        const reminderDays = customer.reminder_time || 1;

        if (daysUntil <= reminderDays && daysUntil >= 0) {
          let priority = 'low';
          if (daysUntil === 0) priority = 'high';
          else if (daysUntil === 1) priority = 'medium';

          return {
            customer_id: customer.customer_id,
            customer_name: customer.name,
            appointment_date: customer.appointment_date,
            days_until: daysUntil,
            priority: priority,
            reminder_time: customer.reminder_time
          };
        }
        return null;
      })
      .filter(n => n !== null);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subscribe client to push notifications
router.post('/subscribePush', async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) {
      return res.status(400).json({ error: 'Subscription required' });
    }
    
    clientSubscriptions.set(subscription.endpoint, subscription);
    console.log('Client subscribed to push notifications');
    
    res.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send push notification (called by scheduler)
async function sendPushToClients(title, body) {
  if (clientSubscriptions.size === 0) {
    console.log('No clients subscribed to push notifications');
    return;
  }

  console.log(Sending push to  clients:, title);
}

// Check for due loans and send notifications
async function checkAndNotifyDueLoans() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const dueLoans = await Loan.find({
      $or: [
        { next_payment_date: { $lte: today }, status: 'active' },
        { next_payment_date: today, status: 'active' }
      ]
    }).lean();

    if (dueLoans.length > 0) {
      await sendPushToClients(
        ' มีเงินกู้ครบกำหนด',
        มี  รายการเงินกู้ที่ครบกำหนด หรือเกินกำหนด
      );
      console.log(Found  due loans);
    }

    const upcomingLoans = await Loan.find({
      next_payment_date: {
        $gte: today,
        $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      status: 'active'
    }).lean();

    if (upcomingLoans.length > 0) {
      await sendPushToClients(
        ' เงินกู้ใกล้ครบกำหนด',
        มี  รายการเงินกู้ที่จะครบกำหนดในอีก 3 วัน
      );
      console.log(Found  upcoming loans);
    }
  } catch (error) {
    console.error('Error checking due loans:', error);
  }
}

// Endpoint to manually trigger check (for testing)
router.post('/checkDueLoans', async (req, res) => {
  try {
    await checkAndNotifyDueLoans();
    res.json({ success: true, message: 'Checked due loans' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get scheduler status
router.post('/getNotificationStatus', async (req, res) => {
  try {
    res.json({
      subscribedClients: clientSubscriptions.size,
      status: 'active'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.checkAndNotifyDueLoans = checkAndNotifyDueLoans;
module.exports.sendPushToClients = sendPushToClients;
