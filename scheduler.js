const cron = require('node-cron');
const { checkAndNotifyDueLoans } = require('./routes/notifications');

// Schedule task to run every hour
// 0 * * * * = every hour at minute 0
const scheduledTask = cron.schedule('0 * * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled notification check...`);
  try {
    await checkAndNotifyDueLoans();
    console.log(`[${new Date().toISOString()}] Notification check completed successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in scheduled notification check:`, error);
  }
});

// Also run immediately on startup (with a slight delay)
setTimeout(async () => {
  console.log('Running initial notification check on startup...');
  try {
    await checkAndNotifyDueLoans();
  } catch (error) {
    console.error('Error in initial notification check:', error);
  }
}, 2000);

// Function to stop the scheduler if needed
function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    console.log('Notification scheduler stopped');
  }
}

module.exports = { stopScheduler };
