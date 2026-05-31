const express = require("express");
const router = express.Router();

const {
  isAuthenticated,
  authorizeRoles,
} = require("../middlewares/authMiddleware");

router.get("/", isAuthenticated, authorizeRoles("owner"), (req, res) => {
  res.render("dashboard/owner", { user: req.session.user });
});

module.exports = router;
