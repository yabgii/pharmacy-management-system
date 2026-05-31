const express = require("express");
const router = express.Router();

const {
  isAuthenticated,
  authorizeRoles,
} = require("../middlewares/authMiddleware");
const batchController = require("../controllers/batchController");

// Batch routes
router.get("/", isAuthenticated, batchController.index);
router.get(
  "/create",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  batchController.createForm
);
router.post(
  "/create",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  batchController.create
);
router.get(
  "/edit/:id",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  batchController.editForm
);
router.post(
  "/edit/:id",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  batchController.update
);
router.post(
  "/delete/:id",
  isAuthenticated,
  authorizeRoles("owner"),
  batchController.delete
);
router.get("/details/:id", isAuthenticated, batchController.getDetails);
router.post(
  "/expiry-notification/:id",
  isAuthenticated,
  authorizeRoles("owner"),
  batchController.updateExpiryNotification
);

module.exports = router;
