const db = require("../config/db");

// LIST ALL BATCHES (WITH SEARCH & FILTERS)
exports.index = async (req, res) => {
  try {
    const search = req.query.search || "";
    const status = req.query.status || "";
    let batches;
    let query = `
      SELECT b.*, 
             m.name as medicine_name, 
             m.unit,
             m.category,
             s.name as supplier_name
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (b.batch_no LIKE ? OR m.name LIKE ? OR s.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status === "expired") {
      query += ` AND b.expiry_date < CURDATE() AND b.quantity > 0`;
    } else if (status === "expiring") {
      query += ` AND b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND b.quantity > 0`;
    } else if (status === "lowstock") {
      query += ` AND b.quantity <= 10 AND b.quantity > 0`;
    } else if (status === "outofstock") {
      query += ` AND b.quantity = 0`;
    }

    query += ` ORDER BY b.expiry_date ASC, b.created_at DESC`;

    [batches] = await db.query(query, params);

    // Calculate statistics
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_batches,
        SUM(CASE WHEN expiry_date < CURDATE() AND quantity > 0 THEN 1 ELSE 0 END) as expired_count,
        SUM(CASE WHEN expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND quantity > 0 THEN 1 ELSE 0 END) as expiring_count,
        SUM(CASE WHEN quantity <= 10 AND quantity > 0 THEN 1 ELSE 0 END) as lowstock_count,
        SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) as outofstock_count,
        SUM(quantity) as total_quantity,
        SUM(quantity * selling_price) as total_value
      FROM batches
    `);

    res.render("batches/index", {
      batches: batches,
      search: search,
      status: status,
      stats: stats[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching batches: " + error.message);
  }
};

// SHOW CREATE FORM
exports.createForm = async (req, res) => {
  try {
    const [medicines] = await db.query(`
      SELECT id, name, unit FROM medicines ORDER BY name
    `);
    const [suppliers] = await db.query(`
      SELECT id, name FROM suppliers ORDER BY name
    `);

    res.render("batches/create", {
      medicines: medicines,
      suppliers: suppliers,
      medicineId: req.query.medicine_id || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading form");
  }
};

// CREATE BATCH
exports.create = async (req, res) => {
  const {
    medicine_id,
    supplier_id,
    batch_no,
    quantity,
    cost_price,
    selling_price,
    manufacture_date,
    expiry_date,
  } = req.body;

  try {
    await db.query(
      `INSERT INTO batches 
       (medicine_id, supplier_id, batch_no, quantity, cost_price, selling_price, 
        manufacture_date, expiry_date, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medicine_id,
        supplier_id || null,
        batch_no,
        quantity,
        cost_price,
        selling_price,
        manufacture_date || null,
        expiry_date,
        req.session.user ? req.session.user.id : null,
      ]
    );

    if (req.flash) req.flash("success", "Batch added successfully!");
    res.redirect("/batches");
  } catch (error) {
    console.error(error);
    if (req.flash) req.flash("error", "Error adding batch: " + error.message);
    res.redirect("/batches/create");
  }
};

// SHOW EDIT FORM
exports.editForm = async (req, res) => {
  const { id } = req.params;

  try {
    const [batches] = await db.query(
      `
      SELECT b.*, m.name as medicine_name 
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      WHERE b.id = ?
    `,
      [id]
    );

    if (batches.length === 0) {
      return res.status(404).send("Batch not found");
    }

    const [medicines] = await db.query(`
      SELECT id, name, unit FROM medicines ORDER BY name
    `);
    const [suppliers] = await db.query(`
      SELECT id, name FROM suppliers ORDER BY name
    `);

    res.render("batches/edit", {
      batch: batches[0],
      medicines: medicines,
      suppliers: suppliers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading edit form");
  }
};

// UPDATE BATCH
exports.update = async (req, res) => {
  const { id } = req.params;
  const {
    medicine_id,
    supplier_id,
    batch_no,
    quantity,
    cost_price,
    selling_price,
    manufacture_date,
    expiry_date,
  } = req.body;

  try {
    await db.query(
      `UPDATE batches 
       SET medicine_id = ?, 
           supplier_id = ?, 
           batch_no = ?, 
           quantity = ?, 
           cost_price = ?, 
           selling_price = ?, 
           manufacture_date = ?, 
           expiry_date = ?
       WHERE id = ?`,
      [
        medicine_id,
        supplier_id || null,
        batch_no,
        quantity,
        cost_price,
        selling_price,
        manufacture_date || null,
        expiry_date,
        id,
      ]
    );

    if (req.flash) req.flash("success", "Batch updated successfully!");
    res.redirect("/batches");
  } catch (error) {
    console.error(error);
    if (req.flash) req.flash("error", "Error updating batch: " + error.message);
    res.redirect(`/batches/edit/${id}`);
  }
};

// DELETE BATCH
exports.delete = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if batch has been used in sales
    const [sales] = await db.query(
      "SELECT COUNT(*) as count FROM sale_items WHERE batch_id = ?",
      [id]
    );

    if (sales[0].count > 0) {
      if (req.flash)
        req.flash("error", "Cannot delete batch that has been sold.");
      return res.redirect("/batches");
    }

    await db.query("DELETE FROM batches WHERE id = ?", [id]);

    if (req.flash) req.flash("success", "Batch deleted successfully!");
    res.redirect("/batches");
  } catch (error) {
    console.error(error);
    if (req.flash) req.flash("error", "Error deleting batch: " + error.message);
    res.redirect("/batches");
  }
};

// GET BATCH DETAILS (AJAX)
exports.getDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const [batches] = await db.query(
      `
      SELECT b.*, 
             m.name as medicine_name, 
             m.unit,
             s.name as supplier_name
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.id = ?
    `,
      [id]
    );

    if (batches.length === 0) {
      return res.status(404).json({ error: "Batch not found" });
    }

    res.json(batches[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching batch details" });
  }
};

// UPDATE EXPIRY NOTIFICATION STATUS
exports.updateExpiryNotification = async (req, res) => {
  const { id } = req.params;
  const { notified } = req.body;

  try {
    await db.query("UPDATE batches SET expiry_notified = ? WHERE id = ?", [
      notified === "true" ? 1 : 0,
      id,
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error updating notification status" });
  }
};
