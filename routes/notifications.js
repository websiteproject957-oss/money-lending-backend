const express = require('express');
const Customer = require('../models/Customer');

const router = express.Router();

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

module.exports = router;
