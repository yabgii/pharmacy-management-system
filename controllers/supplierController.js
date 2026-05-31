const db = require("../config/db");

// LIST ALL SUPPLIERS (WITH SEARCH)
exports.index = async (req, res) => {
  try {
    const search = req.query.search || "";
    let suppliers;

    if (search) {
      [suppliers] = await db.query(
        `
        SELECT s.*, 
               COUNT(DISTINCT b.id) as batch_count,
               COALESCE(SUM(b.quantity), 0) as total_quantity,
               COALESCE(SUM(b.quantity * b.cost_price), 0) as total_purchase_value
        FROM suppliers s
        LEFT JOIN batches b ON s.id = b.supplier_id
        WHERE s.name LIKE ? OR s.email LIKE ? OR s.phone LIKE ?
        GROUP BY s.id
        ORDER BY s.name
      `,
        [`%${search}%`, `%${search}%`, `%${search}%`]
      );
    } else {
      [suppliers] = await db.query(`
        SELECT s.*, 
               COUNT(DISTINCT b.id) as batch_count,
               COALESCE(SUM(b.quantity), 0) as total_quantity,
               COALESCE(SUM(b.quantity * b.cost_price), 0) as total_purchase_value
        FROM suppliers s
        LEFT JOIN batches b ON s.id = b.supplier_id
        GROUP BY s.id
        ORDER BY s.name
      `);
    }

    // FIXED: Use COUNT(DISTINCT s.id) instead of COUNT(*)
    // This counts each supplier only once, regardless of how many batches they have
    const [stats] = await db.query(`
      SELECT 
        COUNT(DISTINCT s.id) as total_suppliers,
        COUNT(DISTINCT b.id) as total_batches,
        COALESCE(SUM(b.quantity * b.cost_price), 0) as total_investment
      FROM suppliers s
      LEFT JOIN batches b ON s.id = b.supplier_id
    `);

    res.render("suppliers/index", {
      suppliers: suppliers,
      search: search,
      stats: stats[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching suppliers: " + error.message);
  }
}; // SHOW CREATE FORM
exports.createForm = (req, res) => {
  res.render("suppliers/create");
};

// CREATE SUPPLIER
exports.create = async (req, res) => {
  const { name, email, phone, address } = req.body;

  try {
    // Check if supplier already exists
    const [existing] = await db.query(
      "SELECT id FROM suppliers WHERE name = ? OR email = ?",
      [name, email]
    );

    if (existing.length > 0) {
      if (req.flash)
        req.flash("error", "Supplier with this name or email already exists");
      return res.redirect("/suppliers/create");
    }

    await db.query(
      "INSERT INTO suppliers (name, email, phone, address) VALUES (?, ?, ?, ?)",
      [name, email || null, phone || null, address || null]
    );

    if (req.flash) req.flash("success", "Supplier added successfully!");
    res.redirect("/suppliers");
  } catch (error) {
    console.error(error);
    if (req.flash)
      req.flash("error", "Error adding supplier: " + error.message);
    res.redirect("/suppliers/create");
  }
};

// SHOW EDIT FORM
exports.editForm = async (req, res) => {
  const { id } = req.params;

  try {
    const [suppliers] = await db.query("SELECT * FROM suppliers WHERE id = ?", [
      id,
    ]);

    if (suppliers.length === 0) {
      return res.status(404).send("Supplier not found");
    }

    res.render("suppliers/edit", { supplier: suppliers[0] });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading edit form");
  }
};

// UPDATE SUPPLIER
exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address } = req.body;

  try {
    // Check if another supplier has same name/email
    const [existing] = await db.query(
      "SELECT id FROM suppliers WHERE (name = ? OR email = ?) AND id != ?",
      [name, email, id]
    );

    if (existing.length > 0) {
      if (req.flash)
        req.flash(
          "error",
          "Another supplier with this name or email already exists"
        );
      return res.redirect(`/suppliers/edit/${id}`);
    }

    await db.query(
      "UPDATE suppliers SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?",
      [name, email || null, phone || null, address || null, id]
    );

    if (req.flash) req.flash("success", "Supplier updated successfully!");
    res.redirect("/suppliers");
  } catch (error) {
    console.error(error);
    if (req.flash)
      req.flash("error", "Error updating supplier: " + error.message);
    res.redirect(`/suppliers/edit/${id}`);
  }
};

// DELETE SUPPLIER
exports.delete = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if supplier has any batches
    const [batches] = await db.query(
      "SELECT COUNT(*) as count FROM batches WHERE supplier_id = ?",
      [id]
    );

    if (batches[0].count > 0) {
      if (req.flash)
        req.flash(
          "error",
          "Cannot delete supplier with existing batches. Reassign or delete batches first."
        );
      return res.redirect("/suppliers");
    }

    await db.query("DELETE FROM suppliers WHERE id = ?", [id]);

    if (req.flash) req.flash("success", "Supplier deleted successfully!");
    res.redirect("/suppliers");
  } catch (error) {
    console.error(error);
    if (req.flash)
      req.flash("error", "Error deleting supplier: " + error.message);
    res.redirect("/suppliers");
  }
};

// GET SUPPLIER DETAILS (AJAX)
// GET SUPPLIER DETAILS (AJAX)
exports.getDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const [suppliers] = await db.query(
      `
      SELECT s.*, 
             COUNT(DISTINCT b.id) as batch_count,
             COALESCE(SUM(b.quantity), 0) as total_quantity,
             COALESCE(SUM(b.quantity * b.cost_price), 0) as total_purchase_value
      FROM suppliers s
      LEFT JOIN batches b ON s.id = b.supplier_id
      WHERE s.id = ?
      GROUP BY s.id
    `,
      [id]
    );

    if (suppliers.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    // Get recent batches from this supplier
    const [recentBatches] = await db.query(
      `
      SELECT b.*, m.name as medicine_name, m.unit
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      WHERE b.supplier_id = ?
      ORDER BY b.created_at DESC
      LIMIT 5
    `,
      [id]
    );

    res.json({
      supplier: suppliers[0], // This now includes total_purchase_value
      recentBatches: recentBatches,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching supplier details" });
  }
};

// GET SUPPLIER BATCHES
// GET SUPPLIER BATCHES
exports.getBatches = async (req, res) => {
  const { id } = req.params;

  try {
    // Get supplier name first
    const [suppliers] = await db.query(
      "SELECT name FROM suppliers WHERE id = ?",
      [id]
    );

    const supplierName = suppliers.length > 0 ? suppliers[0].name : "Supplier";

    const [batches] = await db.query(
      `
        SELECT b.*, 
               m.name as medicine_name, 
               m.unit,
               ? as supplier_name
        FROM batches b
        JOIN medicines m ON b.medicine_id = m.id
        WHERE b.supplier_id = ?
        ORDER BY b.created_at DESC
      `,
      [supplierName, id]
    );

    res.render("suppliers/batches", {
      batches: batches,
      supplierId: id,
      supplierName: supplierName,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching supplier batches");
  }
};
