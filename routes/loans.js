const express = require('express');
const Loan = require('../models/Loan');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');

const router = express.Router();

// Get loans for a customer
router.post('/getLoans', async (req, res) => {
  try {
    const { customerId } = req.body;
    const loans = await Loan.find({ customer_id: customerId }).lean();
    
    // Calculate current balance from payments
    for (let loan of loans) {
      const payments = await Payment.find({ loan_id: loan.loan_id });
      const totalPaid = payments.reduce((sum, p) => sum + p.pay_amount, 0);
      loan.current_balance = loan.principal - totalPaid;
    }
    
    res.json(loans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add loan
router.post('/addLoan', async (req, res) => {
  try {
    const { data } = req.body;
    const loanId = 'LOAN-' + Date.now();
    
    const loan = new Loan({
      loan_id: loanId,
      customer_id: data.customer_id,
      principal: data.principal,
      start_date: data.start_date,
      current_balance: data.principal
    });
    
    await loan.save();
    
    // Update customer total balance
    const customer = await Customer.findOne({ customer_id: data.customer_id });
    if (customer) {
      customer.total_balance = (customer.total_balance || 0) + data.principal;
      await customer.save();
    }
    
    res.json({ loan_id: loanId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
