const express = require('express');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Loan = require('../models/Loan');
const Customer = require('../models/Customer');
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

// Add payment - ตัดดอกก่อน แล้วค่อยตัดต้น
router.post('/addPayment', async (req, res) => {
  try {
    const { data } = req.body;
    const paymentId = 'PAY-' + Date.now();

    // Get loan
    const loan = await Loan.findOne({ loan_id: data.loan_id });
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // Get customer for interest rate
    const customer = await Customer.findOne({ customer_id: loan.customer_id });
    const interestRate = customer ? (customer.interest_rate / 100) : 0;

    const payAmount = parseFloat(data.pay_amount);
    let interestPaid = 0;
    let principalPaid = 0;
    let remainingPayment = payAmount;

    // ขั้นตอนที่ 1: ตัดดอกค้างก่อน
    if (loan.outstanding_interest > 0) {
      if (remainingPayment >= loan.outstanding_interest) {
        // จ่ายดอกค้างหมด
        interestPaid = loan.outstanding_interest;
        remainingPayment -= loan.outstanding_interest;
        loan.outstanding_interest = 0;
      } else {
        // จ่ายดอกไม่หมด
        interestPaid = remainingPayment;
        loan.outstanding_interest -= remainingPayment;
        remainingPayment = 0;
      }
    }

    // ขั้นตอนที่ 2: ตัดเงินต้น (ถ้าเหลือ)
    if (remainingPayment > 0 && loan.principal > 0) {
      if (remainingPayment >= loan.principal) {
        principalPaid = loan.principal;
        loan.principal = 0;
      } else {
        principalPaid = remainingPayment;
        loan.principal -= remainingPayment;
      }
    }

    // อัพเดตยอดรวม
    loan.current_balance = loan.principal + loan.outstanding_interest;

    // ถ้าหมดหนี้ให้เปลี่ยนสถานะ
    if (loan.current_balance <= 0) {
      loan.status = 'paid';
      loan.current_balance = 0;
    }

    await loan.save();

    // บันทึก payment พร้อมรายละเอียดการตัด
    const payment = new Payment({
      payment_id: paymentId,
      loan_id: data.loan_id,
      customer_id: loan.customer_id,
      payment_date: data.payment_date,
      pay_amount: payAmount,
      interest_paid: interestPaid,
      principal_paid: principalPaid,
      slip_url: data.slip_url || '',
      // snapshot ณ ขณะนั้น
      balance_after: loan.current_balance,
      principal_after: loan.principal,
      outstanding_interest_after: loan.outstanding_interest
    });

    await payment.save();

    // Update monthly summary
    const [year, month] = data.payment_date.split('-').slice(0, 2);
    const monthKey = year + '-' + month;

    let summary = await MonthlySummary.findOne({ month: monthKey });
    if (!summary) {
      summary = new MonthlySummary({ month: monthKey });
    }
    // กำไร = ดอกเบี้ยที่เก็บได้
    summary.profit = (summary.profit || 0) + interestPaid;
    // เงินต้นที่ได้คืน
    summary.total_principal = (summary.total_principal || 0) + principalPaid;
    // รวมรับเงินทั้งหมด
    summary.total_received = (summary.total_received || 0) + payAmount;
    await summary.save();

    res.json({ 
      payment_id: paymentId,
      interest_paid: interestPaid,
      principal_paid: principalPaid,
      remaining_balance: loan.current_balance,
      remaining_principal: loan.principal,
      remaining_interest: loan.outstanding_interest
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// คำนวณดอกเบี้ยรายเดือนสำหรับ loan เดียว
async function calculateMonthlyInterest(loan, customer) {
  const interestRate = customer ? (customer.interest_rate / 100) : 0;
  
  // คิดดอกจากยอดรวม (ทบต้น)
  const interestAmount = loan.current_balance * interestRate;
  
  // เพิ่มดอกเข้าไป
  loan.outstanding_interest += interestAmount;
  loan.current_balance = loan.principal + loan.outstanding_interest;
  loan.last_interest_date = new Date().toISOString().split('T')[0];
  
  // ตั้งวันครบกำหนดถัดไป (อีก 1 เดือน)
  const nextDate = new Date();
  nextDate.setMonth(nextDate.getMonth() + 1);
  loan.next_payment_date = nextDate.toISOString().split('T')[0];
  
  await loan.save();
  
  return interestAmount;
}

// API: คำนวณดอกเบี้ยทุก loan ที่ active (เรียกจาก CRON)
router.post('/calculateAllInterest', async (req, res) => {
  try {
    const today = new Date();
    const loans = await Loan.find({ status: 'active' }).lean();
    
    let processed = 0;
    let totalInterest = 0;
    
    for (const loanData of loans) {
      const loan = await Loan.findOne({ loan_id: loanData.loan_id });
      const customer = await Customer.findOne({ customer_id: loan.customer_id });
      
      // ตรวจสอบว่าถึงรอบคิดดอกหรือยัง (1 เดือนนับจาก start_date หรือ last_interest_date)
      let shouldCalculate = false;
      
      if (!loan.last_interest_date) {
        // ยังไม่เคยคิดดอก - ตรวจสอบว่าครบ 1 เดือนจาก start_date
        const startDate = new Date(loan.start_date);
        const monthsSinceStart = (today.getFullYear() - startDate.getFullYear()) * 12 + 
                                  (today.getMonth() - startDate.getMonth());
        if (monthsSinceStart >= 1) {
          shouldCalculate = true;
        }
      } else {
        // เคยคิดดอกแล้ว - ตรวจสอบว่าครบ 1 เดือนจาก last_interest_date
        const lastDate = new Date(loan.last_interest_date);
        const monthsSinceLast = (today.getFullYear() - lastDate.getFullYear()) * 12 + 
                                 (today.getMonth() - lastDate.getMonth());
        if (monthsSinceLast >= 1) {
          shouldCalculate = true;
        }
      }
      
      if (shouldCalculate) {
        const interest = await calculateMonthlyInterest(loan, customer);
        totalInterest += interest;
        processed++;
        console.log('Calculated interest for loan ' + loan.loan_id + ': ' + interest);
      }
    }
    
    res.json({ 
      success: true, 
      processed: processed,
      total_interest_generated: totalInterest 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: ดูรายละเอียด loan พร้อมการคำนวณ
router.post('/getLoanDetails', async (req, res) => {
  try {
    const { loan_id } = req.body;
    const loan = await Loan.findOne({ loan_id }).lean();
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    
    const customer = await Customer.findOne({ customer_id: loan.customer_id });
    const interestRate = customer ? customer.interest_rate : 0;
    
    // ดอกเบี้ยที่จะเกิดรอบถัดไป
    const nextInterest = loan.current_balance * (interestRate / 100);
    
    res.json({
      ...loan,
      interest_rate: interestRate,
      next_interest_amount: nextInterest
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload slip
router.post('/uploadSlip', async (req, res) => {
  try {
    const { file, fileName } = req.body;
    if (!file || !fileName) {
      return res.status(400).json({ error: 'file and fileName are required' });
    }

    const matches = file.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'invalid file data' });
    }
    const contentType = matches[1];
    const data = Buffer.from(matches[2], 'base64');

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'slips' });
    const uploadStream = bucket.openUploadStream(fileName, { contentType });
    uploadStream.end(data, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const baseUrl = process.env.RENDER_EXTERNAL_URL || '';
      const url = baseUrl + '/slip/' + uploadStream.id;
      res.json({ url });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download slip
router.get('/slip/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'slips' });
    const objectId = new mongoose.Types.ObjectId(id);

    const files = await bucket.find({ _id: objectId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'file not found' });
    }
    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    res.set('Content-Disposition', 'inline');

    const downloadStream = bucket.openDownloadStream(objectId);
    downloadStream.on('error', () => res.status(404).json({ error: 'file not found' }));
    downloadStream.pipe(res);
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
