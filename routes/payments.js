const express = require('express');
const mongoose = require('mongoose');
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
    
    // Get customer_id from loan
    const loan = await Loan.findOne({ loan_id: data.loan_id });
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    
    const payment = new Payment({
      payment_id: paymentId,
      loan_id: data.loan_id,
      customer_id: loan.customer_id,
      payment_date: data.payment_date,
      pay_amount: data.pay_amount,
      slip_url: data.slip_url || ''
    });
    
    await payment.save();
    
    // Update loan balance
    loan.current_balance = Math.max(0, loan.current_balance - data.pay_amount);
    await loan.save();
    
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

// Upload slip -> เก็บไฟล์จริงลง MongoDB GridFS แล้วคืน URL สำหรับดาวน์โหลด
router.post('/uploadSlip', async (req, res) => {
  try {
    const { file, fileName } = req.body;
    if (!file || !fileName) {
      return res.status(400).json({ error: 'file and fileName are required' });
    }

    // parse data URL
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
      // สร้าง URL แบบเต็ม เพื่อให้ frontend เปิดดูได้ทันที (inline)
      const baseUrl = process.env.RENDER_EXTERNAL_URL || '';
      const url = `${baseUrl}/slip/${uploadStream.id}`;
      res.json({ url });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ดาวน์โหลด slip
router.get('/slip/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'slips' });
    const objectId = new mongoose.Types.ObjectId(id);

    // ดึงไฟล์และ contentType
    const files = await bucket.find({ _id: objectId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'file not found' });
    }
    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    // ให้เบราว์เซอร์เปิดดู inline ไม่บังคับดาวน์โหลด
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
