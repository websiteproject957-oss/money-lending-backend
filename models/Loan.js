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
    principal: {
      type: Number,
      required: true
    },
    start_date: {
      type: String,
      required: true
    },
    current_balance: {
      type: Number,
      required: true
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
