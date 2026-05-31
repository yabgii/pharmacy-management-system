const express = require("express");
const router = express.Router();

const {
  isAuthenticated,
  authorizeRoles,
} = require("../middlewares/authMiddleware");
const posController = require("../controllers/posController");

// Dashboard routes
router.get(
  "/pharmacist",
  isAuthenticated,
  authorizeRoles("owner", "admin", "pharmacist"),
  posController.pharmacistDashboard
);
router.get(
  "/cashier",
  isAuthenticated,
  authorizeRoles("owner", "admin", "cashier"),
  posController.cashierDashboard
);

// Medicine & Batch routes
router.get(
  "/get-all-medicines",
  isAuthenticated,
  authorizeRoles("owner", "admin", "pharmacist"),
  posController.getAllMedicines
);
router.get(
  "/search-medicines",
  isAuthenticated,
  authorizeRoles("owner", "admin", "pharmacist"),
  posController.searchMedicines
);
router.get(
  "/get-batches/:medicineId",
  isAuthenticated,
  authorizeRoles("owner", "admin", "pharmacist"),
  posController.getMedicineBatches
);

// Sale/Cart routes
router.post(
  "/create-draft-ajax",
  isAuthenticated,
  authorizeRoles("owner", "admin", "pharmacist"),
  posController.createDraftSaleAjax
);
router.post(
  "/add-to-cart-fefo",
  isAuthenticated,
  authorizeRoles("owner", "admin", "pharmacist"),
  posController.addToCartFEFO
);
// REMOVED the GET route - only keep POST
router.post(
  "/complete/:sale_id",
  isAuthenticated,
  authorizeRoles("owner", "admin", "pharmacist"),
  posController.completeSale
);
router.get(
  "/send-to-cashier/:sale_id",
  isAuthenticated,
  authorizeRoles("owner", "admin", "pharmacist"),
  posController.sendToCashier
);
router.get(
  "/cancel/:sale_id",
  isAuthenticated,
  authorizeRoles("owner", "admin", "pharmacist"),
  posController.cancelSale
);

// Active sales & history
router.get(
  "/get-active-sales",
  isAuthenticated,
  authorizeRoles("owner", "admin", "pharmacist"),
  posController.getActiveSales
);
router.get(
  "/get-sales-history",
  isAuthenticated,
  authorizeRoles("owner", "admin", "pharmacist"),
  posController.getSalesHistory
);

// Cashier routes
router.get(
  "/details/:sale_id",
  isAuthenticated,
  authorizeRoles("owner", "admin", "cashier", "pharmacist"),
  posController.getSaleDetails
);
router.post(
  "/confirm-payment/:sale_id",
  isAuthenticated,
  authorizeRoles("owner", "admin", "cashier"),
  posController.confirmPayment
);

// Receipt route
router.get("/receipt/:sale_id", isAuthenticated, posController.printReceipt);

module.exports = router;
