const mongoose = require('mongoose');

const monthlySummarySchema = new mongoose.Schema(
  {
    month: {
      type: String, // Format: YYYY-MM
      required: true,
      unique: true,
      index: true
    },
    total_interest: {
      type: Number,
      default: 0
    },
    total_principal: {
      type: Number,
      default: 0
    },
    profit: {
      type: Number,
      default: 0
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

module.exports = mongoose.model('MonthlySummary', monthlySummarySchema);
