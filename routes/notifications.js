const express = require('express');
const webpush = require('web-push');
const Customer = require('../models/Customer');
const Loan = require('../models/Loan');
const PushSubscription = require('../models/PushSubscription');

const router = express.Router();

// VAPID Keys - ต้องตั้งค่าใน Render Environment Variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BLBx-hf2WrL2qEa0qKb-aCJbcxEvyn62GDYwW2UpxsRpmMYGE0fRHC1cUumPJXR7d6eLt1N73-6OYqAIa7g0rF4';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'FvJxy9rQ_7SbKdN5YhfRIeZ8tPKJqR-2gLnCvB_0xjk';

// Configure web-push
webpush.setVapidDetails(
  'mailto:admin@moneylending.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Get VAPID public key for frontend
router.post('/getVapidPublicKey', async (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

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

// Subscribe to push notifications - save to database
router.post('/subscribePush', async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Valid subscription required' });
    }

    // Save or update subscription in database
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      },
      { upsert: true, new: true }
    );

    console.log('Client subscribed to push notifications');
    res.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribePush', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    await PushSubscription.deleteOne({ endpoint });
    console.log('Client unsubscribed from push notifications');
    res.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send push notification to all subscribers
async function sendPushToAllSubscribers(title, body, data = {}) {
  try {
    const subscriptions = await PushSubscription.find().lean();
    
    if (subscriptions.length === 0) {
      console.log('No subscribers to send push notifications');
      return { sent: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'mlm-notification',
      data
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: sub.keys
        }, payload);
        sent++;
      } catch (error) {
        console.error('Push failed for:', sub.endpoint, error.message);
        // Remove invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          await PushSubscription.deleteOne({ endpoint: sub.endpoint });
        }
        failed++;
      }
    }

    console.log(`Push notifications sent: ${sent}, failed: ${failed}`);
    return { sent, failed };
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return { sent: 0, failed: 0, error: error.message };
  }
}

// Check for due loans and send notifications
async function checkAndNotifyDueLoans() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Find overdue or due today
    const dueLoans = await Loan.find({
      next_payment_date: { $lte: today },
      status: 'active'
    }).lean();

    if (dueLoans.length > 0) {
      await sendPushToAllSubscribers(
        '📢 มีเงินกู้ครบกำหนด!',
        `มี ${dueLoans.length} รายการเงินกู้ที่ครบกำหนดหรือเกินกำหนด`,
        { type: 'due', count: dueLoans.length }
      );
    }

    // Find upcoming (within 3 days)
    const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const upcomingLoans = await Loan.find({
      next_payment_date: { $gt: today, $lte: threeDaysLater },
      status: 'active'
    }).lean();

    if (upcomingLoans.length > 0) {
      await sendPushToAllSubscribers(
        '📅 เงินกู้ใกล้ครบกำหนด',
        `มี ${upcomingLoans.length} รายการที่จะครบกำหนดในอีก 3 วัน`,
        { type: 'upcoming', count: upcomingLoans.length }
      );
    }

    return { dueLoans: dueLoans.length, upcomingLoans: upcomingLoans.length };
  } catch (error) {
    console.error('Error checking due loans:', error);
    return { error: error.message };
  }
}

// Manual trigger to check due loans
router.post('/checkDueLoans', async (req, res) => {
  try {
    const result = await checkAndNotifyDueLoans();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send test notification
router.post('/sendTestPush', async (req, res) => {
  try {
    const result = await sendPushToAllSubscribers(
      '🔔 ทดสอบการแจ้งเตือน',
      'ระบบแจ้งเตือนทำงานปกติ!',
      { type: 'test' }
    );
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notification status
router.post('/getNotificationStatus', async (req, res) => {
  try {
    const count = await PushSubscription.countDocuments();
    res.json({
      subscribedClients: count,
      vapidConfigured: !!VAPID_PUBLIC_KEY,
      status: 'active'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.checkAndNotifyDueLoans = checkAndNotifyDueLoans;
module.exports.sendPushToAllSubscribers = sendPushToAllSubscribers;
