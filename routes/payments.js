const express = require('express');
const Payment = require('../models/Payment');
const Loan = require('../models/Loan');
const MonthlySummary = require('../models/MonthlySummary');

const router = express.Router();

// Get all payments
router.post('/getPayments', async (req, res) => {
  try {
    const payments = await Payment.find().lean();
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add payment
router.post('/addPayment', async (req, res) => {
  try {
    const { data } = req.body;
    const paymentId = 'PAY-' + Date.now();
    
    const payment = new Payment({
      payment_id: paymentId,
      loan_id: data.loan_id,
      customer_id: data.customer_id,
      payment_date: data.payment_date,
      pay_amount: data.pay_amount,
      slip_url: data.slip_url || ''
    });
    
    await payment.save();
    
    // Update loan balance
    const loan = await Loan.findOne({ loan_id: data.loan_id });
    if (loan) {
      loan.current_balance = Math.max(0, loan.current_balance - data.pay_amount);
      await loan.save();
    }
    
    // Calculate and update monthly summary
    const [year, month] = data.payment_date.split('-').slice(0, 2).join('-').split('-');
    const monthKey = `${year}-${month}`;
    
    let summary = await MonthlySummary.findOne({ month: monthKey });
    if (!summary) {
      summary = new MonthlySummary({ month: monthKey });
    }
    summary.total_principal = (summary.total_principal || 0) + data.pay_amount;
    summary.profit = (summary.profit || 0) + data.pay_amount;
    await summary.save();
    
    res.json({ payment_id: paymentId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly summary
router.post('/getMonthlySummary', async (req, res) => {
  try {
    const summary = await MonthlySummary.find().sort({ month: -1 }).lean();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
