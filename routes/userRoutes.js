const express = require("express");
const router = express.Router();

const {
  isAuthenticated,
  authorizeRoles,
} = require("../middlewares/authMiddleware");
const userController = require("../controllers/userController");

// All user routes require authentication and owner role
router.use(isAuthenticated);
router.use(authorizeRoles("owner"));

// User management routes
router.get("/", userController.index);
router.get("/create", userController.createForm);
router.post("/create", userController.create);
router.get("/edit/:id", userController.editForm);
router.post("/edit/:id", userController.update);
router.post("/change-password/:id", userController.changePassword);
router.post("/toggle-status/:id", userController.toggleStatus);
router.post("/delete/:id", userController.delete);
router.get("/details/:id", userController.getDetails);

module.exports = router;
