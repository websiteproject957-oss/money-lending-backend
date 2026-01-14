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
    pay_amount: {
      type: Number,
      required: true
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
