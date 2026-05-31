const db = require("../config/db");
const bcrypt = require("bcrypt");

// LIST ALL USERS (WITH SEARCH & FILTER)
exports.index = async (req, res) => {
  try {
    const search = req.query.search || "";
    const role = req.query.role || "";
    const status = req.query.status || "";

    let query = `
      SELECT id, name, username, email, role, status, created_at
      FROM users 
      WHERE id != ? 
    `;
    const params = [req.session.user.id]; // Exclude current logged-in user

    if (search) {
      query += ` AND (name LIKE ? OR username LIKE ? OR email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role) {
      query += ` AND role = ?`;
      params.push(role);
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const [users] = await db.query(query, params);

    // Get statistics
    const [stats] = await db.query(
      `
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as total_admins,
        SUM(CASE WHEN role = 'seller' THEN 1 ELSE 0 END) as total_sellers,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_users
      FROM users
      WHERE id != ?
    `,
      [req.session.user.id]
    );

    res.render("users/index", {
      users: users,
      search: search,
      role: role,
      status: status,
      stats: stats[0],
      success_msg: req.flash("success"),
      error_msg: req.flash("error"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching users: " + error.message);
  }
};

// SHOW CREATE FORM
exports.createForm = (req, res) => {
  res.render("users/create", {
    error_msg: req.flash("error"),
  });
};

// CREATE USER
exports.create = async (req, res) => {
  const { name, username, email, password, role } = req.body;

  try {
    // Check if username already exists
    const [existingUsername] = await db.query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existingUsername.length > 0) {
      req.flash("error", "Username already taken");
      return res.redirect("/users/create");
    }

    // Check if email already exists
    const [existingEmail] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingEmail.length > 0) {
      req.flash("error", "Email already registered");
      return res.redirect("/users/create");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (name, username, email, password, role, status) 
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [name, username, email, hashedPassword, role]
    );

    req.flash("success", "User created successfully!");
    res.redirect("/users");
  } catch (error) {
    console.error(error);
    req.flash("error", "Error creating user: " + error.message);
    res.redirect("/users/create");
  }
};

// SHOW EDIT FORM
exports.editForm = async (req, res) => {
  const { id } = req.params;

  try {
    const [users] = await db.query(
      "SELECT id, name, username, email, role, status FROM users WHERE id = ?",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).send("User not found");
    }

    res.render("users/edit", {
      user: users[0],
      error_msg: req.flash("error"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading edit form");
  }
};

// UPDATE USER
exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, username, email, role, status } = req.body;

  try {
    // Check if username exists for another user
    const [existingUsername] = await db.query(
      "SELECT id FROM users WHERE username = ? AND id != ?",
      [username, id]
    );

    if (existingUsername.length > 0) {
      req.flash("error", "Username already taken by another user");
      return res.redirect(`/users/edit/${id}`);
    }

    // Check if email exists for another user
    const [existingEmail] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email, id]
    );

    if (existingEmail.length > 0) {
      req.flash("error", "Email already registered to another user");
      return res.redirect(`/users/edit/${id}`);
    }

    await db.query(
      `UPDATE users 
       SET name = ?, username = ?, email = ?, role = ?, status = ?
       WHERE id = ?`,
      [name, username, email, role, status, id]
    );

    req.flash("success", "User updated successfully!");
    res.redirect("/users");
  } catch (error) {
    console.error(error);
    req.flash("error", "Error updating user: " + error.message);
    res.redirect(`/users/edit/${id}`);
  }
};

// CHANGE USER PASSWORD
exports.changePassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      id,
    ]);

    req.flash("success", "Password changed successfully!");
    res.redirect("/users");
  } catch (error) {
    console.error(error);
    req.flash("error", "Error changing password: " + error.message);
    res.redirect(`/users/edit/${id}`);
  }
};

// TOGGLE USER STATUS (Active/Inactive)
exports.toggleStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const [users] = await db.query("SELECT status FROM users WHERE id = ?", [
      id,
    ]);

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const newStatus = users[0].status === "active" ? "inactive" : "active";

    await db.query("UPDATE users SET status = ? WHERE id = ?", [newStatus, id]);

    if (req.xhr) {
      res.json({ success: true, status: newStatus });
    } else {
      req.flash(
        "success",
        `User ${
          newStatus === "active" ? "activated" : "deactivated"
        } successfully!`
      );
      res.redirect("/users");
    }
  } catch (error) {
    console.error(error);
    if (req.xhr) {
      res.status(500).json({ error: "Error toggling status" });
    } else {
      req.flash("error", "Error toggling user status");
      res.redirect("/users");
    }
  }
};

// DELETE USER
exports.delete = async (req, res) => {
  const { id } = req.params;

  try {
    // Don't allow deleting own account
    if (id == req.session.user.id) {
      req.flash("error", "You cannot delete your own account");
      return res.redirect("/users");
    }

    await db.query("DELETE FROM users WHERE id = ?", [id]);

    req.flash("success", "User deleted successfully!");
    res.redirect("/users");
  } catch (error) {
    console.error(error);
    req.flash("error", "Error deleting user: " + error.message);
    res.redirect("/users");
  }
};

// GET USER DETAILS (AJAX)
exports.getDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const [users] = await db.query(
      `
      SELECT id, name, username, email, role, status, created_at
      FROM users 
      WHERE id = ?
    `,
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(users[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching user details" });
  }
};
