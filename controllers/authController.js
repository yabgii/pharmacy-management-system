const db = require("../config/db");
const bcrypt = require("bcrypt");

exports.showLogin = async (req, res) => {
  const [owners] = await db.query(
    "SELECT id FROM users WHERE role = 'owner' LIMIT 1"
  );

  const ownerExists = owners.length > 0;
  const error = req.query.error || null;

  res.render("auth/login", { ownerExists, error });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  const [rows] = await db.query(
    'SELECT * FROM users WHERE username = ? AND status = "active"',
    [username]
  );

  if (rows.length === 0) {
    return res.redirect("/auth/login?error=Invalid username or password");
  }

  const user = rows[0];

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.redirect("/auth/login?error=Invalid username or password");
  }

  // Store minimal info in session
  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  // Role-based redirect
  if (user.role === "owner") {
    return res.redirect("/dashboard");
  } else if (user.role === "pharmacist") {
    return res.redirect("/pos/pharmacist");
  } else if (user.role === "cashier") {
    return res.redirect("/pos/cashier");
  }

  res.redirect("/");
};

exports.showRegister = async (req, res) => {
  const [owners] = await db.query(
    "SELECT id FROM users WHERE role = 'owner' LIMIT 1"
  );

  if (owners.length > 0) {
    return res.redirect("/auth/login");
  }

  const error = req.query.error || null;
  res.render("auth/register", { error });
};

exports.register = async (req, res) => {
  const { name, email, username, password } = req.body;

  // Check if email already exists
  const [existingEmail] = await db.query(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );
  if (existingEmail.length > 0) {
    return res.redirect("/auth/register?error=Email already registered");
  }

  // Check if username already exists
  const [existingUser] = await db.query(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );
  if (existingUser.length > 0) {
    return res.redirect("/auth/register?error=Username already taken");
  }

  const [owners] = await db.query("SELECT * FROM users WHERE role = 'owner'");

  if (owners.length > 0) {
    return res.redirect("/auth/login?error=Owner already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.query(
    "INSERT INTO users (name, email, username, password, role) VALUES (?, ?, ?, ?, 'owner')",
    [name, email, username, hashedPassword]
  );

  res.redirect(
    "/auth/login?success=Owner account created successfully! Please login."
  );
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/auth/login");
  });
};
