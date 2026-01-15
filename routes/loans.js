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
    const principal = parseFloat(data.principal);

    // คำนวณวันครบกำหนดชำระ (1 เดือนหลังวันเริ่มกู้)
    const startDate = new Date(data.start_date);
    const nextPaymentDate = new Date(startDate);
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    const loan = new Loan({
      loan_id: loanId,
      customer_id: data.customer_id,
      original_principal: principal,
      principal: principal,
      outstanding_interest: 0,
      current_balance: principal,
      start_date: data.start_date,
      last_interest_date: '',
      next_payment_date: nextPaymentDate.toISOString().split('T')[0],
      status: 'active'
    });

    await loan.save();

    // Update customer total balance
    const customer = await Customer.findOne({ customer_id: data.customer_id });
    if (customer) {
      customer.total_balance = (customer.total_balance || 0) + principal;
      await customer.save();
    }

    res.json({ loan_id: loanId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update loan
router.post('/updateLoan', async (req, res) => {
  try {
    const { loan_id, data } = req.body;
    const loan = await Loan.findOne({ loan_id });
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // อัพเดตเฉพาะ field ที่ส่งมา
    if (data.principal !== undefined) {
      loan.principal = parseFloat(data.principal);
    }
    if (data.outstanding_interest !== undefined) {
      loan.outstanding_interest = parseFloat(data.outstanding_interest);
    }
    if (data.status) {
      loan.status = data.status;
    }
    
    // คำนวณ current_balance ใหม่
    loan.current_balance = loan.principal + loan.outstanding_interest;
    
    await loan.save();
    res.json({ success: true, loan });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete loan
router.post('/deleteLoan', async (req, res) => {
  try {
    const { loan_id } = req.body;
    const loan = await Loan.findOne({ loan_id });
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // อัพเดต customer total balance
    const customer = await Customer.findOne({ customer_id: loan.customer_id });
    if (customer) {
      customer.total_balance = Math.max(0, (customer.total_balance || 0) - loan.current_balance);
      await customer.save();
    }

    // ลบ payments ที่เกี่ยวข้อง
    await Payment.deleteMany({ loan_id });
    
    // ลบ loan
    await Loan.deleteOne({ loan_id });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Migrate old loans to new structure
router.post('/migrateLoans', async (req, res) => {
  try {
    const loans = await Loan.find();
    let migrated = 0;
    
    for (const loan of loans) {
      let needsSave = false;
      
      // เพิ่ม original_principal ถ้ายังไม่มี
      if (!loan.original_principal) {
        loan.original_principal = loan.principal || loan.current_balance || 0;
        needsSave = true;
      }
      
      // เพิ่ม principal ถ้ายังไม่มี
      if (loan.principal === undefined || loan.principal === null) {
        loan.principal = loan.current_balance || loan.original_principal || 0;
        needsSave = true;
      }
      
      // เพิ่ม outstanding_interest ถ้ายังไม่มี
      if (loan.outstanding_interest === undefined || loan.outstanding_interest === null) {
        loan.outstanding_interest = 0;
        needsSave = true;
      }
      
      // เพิ่ม status ถ้ายังไม่มี
      if (!loan.status) {
        loan.status = loan.current_balance > 0 ? 'active' : 'paid';
        needsSave = true;
      }
      
      // เพิ่ม next_payment_date ถ้ายังไม่มี
      if (!loan.next_payment_date && loan.start_date) {
        const startDate = new Date(loan.start_date);
        const nextDate = new Date(startDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        loan.next_payment_date = nextDate.toISOString().split('T')[0];
        needsSave = true;
      }
      
      if (needsSave) {
        await loan.save();
        migrated++;
      }
    }
    
    res.json({ 
      success: true, 
      message: `Migrated ${migrated} loans`,
      total: loans.length,
      migrated: migrated
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

