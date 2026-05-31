require("dotenv").config();
const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const path = require("path");

const app = express();
// Flash messages middleware

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(
  session({
    secret: "secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(flash());

// Make flash messages available to all views
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success");
  res.locals.error_msg = req.flash("error");
  next();
});
// View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static Files
app.use(express.static("public"));

// Routes
app.use("/auth", require("./routes/authRoutes"));
app.use("/dashboard", require("./routes/dashboardRoutes"));
app.use("/medicines", require("./routes/medicineRoutes"));
app.use("/batches", require("./routes/batchRoutes"));
app.use("/suppliers", require("./routes/supplierRoutes"));
app.use("/users", require("./routes/userRoutes"));
app.use("/sales", require("./routes/salesRoutes"));
// Add with your other routes
app.use("/pos", require("./routes/posRoutes"));
// Notification routes (for testing)
app.use("/notifications", require("./routes/notificationRoutes"));

app.use("/reports", require("./routes/reportsRoutes"));

app.get("/", (req, res) => {
  res.redirect("/auth/login");
});
// Start notification schedulers
const { startSchedulers } = require("./cron/notificationScheduler");
startSchedulers();
// Server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
