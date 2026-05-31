const express = require("express");
const router = express.Router();

const {
  isAuthenticated,
  authorizeRoles,
} = require("../middlewares/authMiddleware");
const supplierController = require("../controllers/supplierController");

// Supplier routes
router.get("/", isAuthenticated, supplierController.index);
router.get(
  "/create",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  supplierController.createForm
);
router.post(
  "/create",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  supplierController.create
);
router.get(
  "/edit/:id",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  supplierController.editForm
);
router.post(
  "/edit/:id",
  isAuthenticated,
  authorizeRoles("owner", "admin"),
  supplierController.update
);
router.post(
  "/delete/:id",
  isAuthenticated,
  authorizeRoles("owner"),
  supplierController.delete
);
router.get("/details/:id", isAuthenticated, supplierController.getDetails);
router.get("/batches/:id", isAuthenticated, supplierController.getBatches);

module.exports = router;
