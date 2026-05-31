const express = require("express");
const router = express.Router();
const {
  isAuthenticated,
  authorizeRoles,
} = require("../middlewares/authMiddleware");
const {
  checkExpiryAlerts,
  checkLowStockAlerts,
  sendWeeklySummary,
} = require("../services/notificationService");

// ============ DEVELOPMENT ONLY - Remove in production ============
// Test route without authentication (for easy testing)
router.get("/test-dev/expiry", async (req, res) => {
  try {
    await checkExpiryAlerts();
    res.send("✅ Expiry check triggered! Check your email.");
  } catch (error) {
    console.error(error);
    res.send("❌ Error: " + error.message);
  }
});

router.get("/test-dev/lowstock", async (req, res) => {
  try {
    await checkLowStockAlerts();
    res.send("✅ Low stock check triggered! Check your email.");
  } catch (error) {
    console.error(error);
    res.send("❌ Error: " + error.message);
  }
});

router.get("/test-dev/weekly", async (req, res) => {
  try {
    await sendWeeklySummary();
    res.send("✅ Weekly summary triggered! Check your email.");
  } catch (error) {
    console.error(error);
    res.send("❌ Error: " + error.message);
  }
});

// ============ Production routes with auth ============
router.post(
  "/test/expiry",
  isAuthenticated,
  authorizeRoles("owner"),
  async (req, res) => {
    try {
      await checkExpiryAlerts();
      res.json({
        success: true,
        message: "Expiry check triggered successfully",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.post(
  "/test/lowstock",
  isAuthenticated,
  authorizeRoles("owner"),
  async (req, res) => {
    try {
      await checkLowStockAlerts();
      res.json({
        success: true,
        message: "Low stock check triggered successfully",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.post(
  "/test/weekly",
  isAuthenticated,
  authorizeRoles("owner"),
  async (req, res) => {
    try {
      await sendWeeklySummary();
      res.json({
        success: true,
        message: "Weekly summary triggered successfully",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;
