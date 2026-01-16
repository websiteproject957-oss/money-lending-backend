const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    loan_id: {
      type: String,
      unique: true,
      required: true,
      index: true
    },
    customer_id: {
      type: String,
      required: true,
      index: true
    },
    // เงินต้นเริ่มต้น (ไม่เปลี่ยน)
    original_principal: {
      type: Number,
      default: 0
    },
    // เงินต้นคงเหลือ
    principal: {
      type: Number,
      default: 0
    },
    // ดอกเบี้ยค้างสะสม (ที่ยังไม่ได้จ่าย)
    outstanding_interest: {
      type: Number,
      default: 0
    },
    // ดอกเบี้ยรวมที่จ่ายไปแล้ว
    total_interest_paid: {
      type: Number,
      default: 0
    },
    // จ่ายดอกถึงเดือนที่ (นับจากวันเริ่มกู้)
    interest_paid_until_month: {
      type: Number,
      default: 0
    },
    // วันที่จ่ายดอกล่าสุด
    last_interest_payment_date: {
      type: String,
      default: ''
    },
    // ยอดรวมทั้งหมด (เงินต้น + ดอกค้าง)
    current_balance: {
      type: Number,
      default: 0
    },
    // วันเริ่มกู้
    start_date: {
      type: String,
      default: ''
    },
    // วันที่คิดดอกครั้งล่าสุด
    last_interest_date: {
      type: String,
      default: ''
    },
    // วันครบกำหนดชำระถัดไป
    next_payment_date: {
      type: String,
      default: ''
    },
    // สถานะ
    status: {
      type: String,
      enum: ['active', 'paid', 'defaulted'],
      default: 'active'
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

module.exports = mongoose.model('Loan', loanSchema);
