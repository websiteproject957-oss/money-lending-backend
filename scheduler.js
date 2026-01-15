const cron = require('node-cron');
const notificationRouter = require('./routes/notifications');
const checkAndNotifyDueLoans = notificationRouter.checkAndNotifyDueLoans;

// Import models for interest calculation
const Loan = require('./models/Loan');
const Customer = require('./models/Customer');

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

// คำนวณดอกเบี้ยทุก loan ที่ครบรอบ
async function calculateAllInterest() {
  try {
    const today = new Date();
    const loans = await Loan.find({ status: 'active' });
    
    let processed = 0;
    let totalInterest = 0;
    
    for (const loan of loans) {
      const customer = await Customer.findOne({ customer_id: loan.customer_id });
      
      // ตรวจสอบว่าถึงรอบคิดดอกหรือยัง
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
    
    console.log('Interest calculation done. Processed: ' + processed + ', Total: ' + totalInterest);
    return { processed, totalInterest };
  } catch (error) {
    console.error('Error calculating interest:', error);
    return { error: error.message };
  }
}

// Schedule notification check every hour
const notificationTask = cron.schedule('0 * * * *', async () => {
  console.log('[' + new Date().toISOString() + '] Running scheduled notification check...');
  try {
    await checkAndNotifyDueLoans();
    console.log('[' + new Date().toISOString() + '] Notification check completed');
  } catch (error) {
    console.error('[' + new Date().toISOString() + '] Error in notification check:', error);
  }
});

// Schedule interest calculation every day at 00:01 (ตรวจทุกวันแต่คิดเฉพาะที่ครบเดือน)
const interestTask = cron.schedule('1 0 * * *', async () => {
  console.log('[' + new Date().toISOString() + '] Running scheduled interest calculation...');
  try {
    await calculateAllInterest();
    console.log('[' + new Date().toISOString() + '] Interest calculation completed');
  } catch (error) {
    console.error('[' + new Date().toISOString() + '] Error in interest calculation:', error);
  }
});

// Run initial checks on startup
setTimeout(async () => {
  console.log('Running initial checks on startup...');
  try {
    await checkAndNotifyDueLoans();
    await calculateAllInterest();
  } catch (error) {
    console.error('Error in initial checks:', error);
  }
}, 3000);

// Function to stop schedulers
function stopScheduler() {
  if (notificationTask) {
    notificationTask.stop();
    console.log('Notification scheduler stopped');
  }
  if (interestTask) {
    interestTask.stop();
    console.log('Interest scheduler stopped');
  }
}

module.exports = { stopScheduler, calculateAllInterest };
