const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    customer_id: {
      type: String,
      unique: true,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      default: ''
    },
    interest_rate: {
      type: Number,
      default: 0
    },
    appointment_date: {
      type: String,
      default: ''
    },
    reminder_time: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ['ปกติ', 'ค้าง', 'หนี้เสีย'],
      default: 'ปกติ'
    },
    total_balance: {
      type: Number,
      default: 0
    },
    created_date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0]
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Customer', customerSchema);
