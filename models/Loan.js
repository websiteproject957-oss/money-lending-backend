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
      required: true
    },
    // เงินต้นคงเหลือ (ลดลงเมื่อจ่ายเกินดอก)
    principal: {
      type: Number,
      required: true
    },
    // ดอกเบี้ยค้างสะสม
    outstanding_interest: {
      type: Number,
      default: 0
    },
    // ยอดรวมทั้งหมด (เงินต้น + ดอกค้าง) - ใช้คิดดอกทบต้น
    current_balance: {
      type: Number,
      required: true
    },
    // วันเริ่มกู้
    start_date: {
      type: String,
      required: true
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
