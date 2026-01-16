const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    payment_id: {
      type: String,
      unique: true,
      required: true,
      index: true
    },
    loan_id: {
      type: String,
      required: true,
      index: true
    },
    customer_id: {
      type: String,
      required: true,
      index: true
    },
    payment_date: {
      type: String,
      required: true
    },
    // ยอดจ่ายดอก
    interest_paid: {
      type: Number,
      default: 0
    },
    // ยอดจ่ายต้น
    principal_paid: {
      type: Number,
      default: 0
    },
    // ยอดรวมที่จ่าย
    pay_amount: {
      type: Number,
      default: 0
    },
    // จ่ายดอกสำหรับเดือนที่
    for_interest_month: {
      type: Number,
      default: 0
    },
    // Snapshot หลังจ่าย
    balance_after: {
      type: Number,
      default: 0
    },
    principal_after: {
      type: Number,
      default: 0
    },
    outstanding_interest_after: {
      type: Number,
      default: 0
    },
    // หมายเหตุ
    note: {
      type: String,
      default: ''
    },
    slip_url: {
      type: String,
      default: ''
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Payment', paymentSchema);
