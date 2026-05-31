const express = require("express");
const router = express.Router();

const {
  isAuthenticated,
  authorizeRoles,
} = require("../middlewares/authMiddleware");
const reportsController = require("../controllers/reportsController");

// Reports route (only owner can view)
router.get(
  "/",
  isAuthenticated,
  authorizeRoles("owner"),
  reportsController.index
);
router.get(
  "/export",
  isAuthenticated,
  authorizeRoles("owner"),
  reportsController.exportCSV
);
router.get(
  "/deadstock",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  reportsController.getDeadStockReport
);
router.get(
  "/peakhours",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  reportsController.getPeakHoursReport
);
router.get(
  "/payment-methods",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  reportsController.getPaymentMethodReport
);
module.exports = router;
