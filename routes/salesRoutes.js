const express = require("express");
const router = express.Router();

const {
  isAuthenticated,
  authorizeRoles,
} = require("../middlewares/authMiddleware");
const salesController = require("../controllers/salesController");

// Sales report routes
router.get("/", isAuthenticated, salesController.index);
router.get("/details/:id", isAuthenticated, salesController.getSaleDetails);
router.get(
  "/export",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  salesController.exportReport
);
router.get("/api/daily", isAuthenticated, salesController.getDailySalesData);

module.exports = router;
