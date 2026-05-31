const express = require("express");
const router = express.Router();

const {
  isAuthenticated,
  authorizeRoles,
} = require("../middlewares/authMiddleware");
const medicineController = require("../controllers/medicineController");

// Medicine routes
router.get("/", isAuthenticated, medicineController.index);
router.get(
  "/create",
  isAuthenticated,
  authorizeRoles("owner"),
  medicineController.createForm
);
router.post(
  "/create",
  isAuthenticated,
  authorizeRoles("owner"),
  medicineController.create
);
router.get(
  "/edit/:id",
  isAuthenticated,
  authorizeRoles("owner"),
  medicineController.editForm
);
router.post(
  "/edit/:id",
  isAuthenticated,
  authorizeRoles("owner"),
  medicineController.update
);
router.post(
  "/delete/:id",
  isAuthenticated,
  authorizeRoles("owner"),
  medicineController.delete
);

// Batch routes
router.post(
  "/batch/add/:medicineId",
  isAuthenticated,
  authorizeRoles("owner"),
  medicineController.addBatch
);
router.post(
  "/batch/edit/:batchId",
  isAuthenticated,
  authorizeRoles("owner"),
  medicineController.editBatch
);
router.post(
  "/batch/delete/:batchId",
  isAuthenticated,
  authorizeRoles("owner"),
  medicineController.deleteBatch
);
router.get(
  "/batch/:batchId",
  isAuthenticated,
  medicineController.getBatchDetails
);
router.post(
  "/batch/quantity/:batchId",
  isAuthenticated,
  authorizeRoles("owner"),
  medicineController.updateBatchQuantity
);

module.exports = router;
