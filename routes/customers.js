const express = require('express');
const Customer = require('../models/Customer');

const router = express.Router();

// Get all customers
router.post('/getCustomers', async (req, res) => {
  try {
    const customers = await Customer.find().lean();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add customer
router.post('/addCustomer', async (req, res) => {
  try {
    const { data } = req.body;
    const customerId = 'CUST-' + Date.now();
    
    const customer = new Customer({
      customer_id: customerId,
      name: data.name,
      phone: data.phone || '',
      interest_rate: data.interest_rate || 0,
      appointment_date: data.appointment_date || '',
      reminder_time: data.reminder_time || 1,
      status: data.status || 'ปกติ',
      total_balance: 0
    });
    
    await customer.save();
    res.json({ customer_id: customerId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update customer
router.post('/updateCustomer', async (req, res) => {
  try {
    const { id, data } = req.body;
    const customer = await Customer.findOneAndUpdate(
      { customer_id: id },
      {
        name: data.name,
        phone: data.phone || '',
        interest_rate: data.interest_rate || 0,
        appointment_date: data.appointment_date || '',
        reminder_time: data.reminder_time || 1,
        status: data.status || 'ปกติ'
      },
      { new: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete customer
router.post('/deleteCustomer', async (req, res) => {
  try {
    const { id } = req.body;
    await Customer.deleteOne({ customer_id: id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
