const cron = require("node-cron");
const {
  checkExpiryAlerts,
  checkLowStockAlerts,
  sendWeeklySummary,
} = require("../services/notificationService");

// Schedule tasks
const startSchedulers = () => {
  // Run expiry check every day at 8:00 AM
  cron.schedule("0 8 * * *", async () => {
    console.log("Running expiry alert check...");
    await checkExpiryAlerts();
  });

  // Run low stock check every day at 8:30 AM
  cron.schedule("30 8 * * *", async () => {
    console.log("Running low stock alert check...");
    await checkLowStockAlerts();
  });

  // Run weekly summary every Monday at 9:00 AM
  cron.schedule("0 9 * * 1", async () => {
    console.log("Running weekly summary...");
    await sendWeeklySummary();
  });

  console.log("Notification schedulers started");
  console.log("  - Expiry alerts: Daily at 8:00 AM");
  console.log("  - Low stock alerts: Daily at 8:30 AM");
  console.log("  - Weekly summary: Every Monday at 9:00 AM");
};

module.exports = { startSchedulers };
