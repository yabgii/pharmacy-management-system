const db = require("../config/db");

// LIST ALL MEDICINES (WITH SEARCH)
// LIST ALL MEDICINES (WITH SEARCH AND BATCHES)
// LIST ALL MEDICINES (WITH SEARCH)
exports.index = async (req, res) => {
  try {
    const search = req.query.search || "";
    let medicines;

    console.log("Search term:", search); // Debug log

    if (search) {
      // Search in name, generic_name, or category
      [medicines] = await db.query(
        `
        SELECT m.*, 
               mf.name as manufacturer_name,
               COALESCE(SUM(b.quantity), 0) as total_stock,
               COUNT(b.id) as batch_count
        FROM medicines m
        LEFT JOIN manufacturers mf ON m.manufacturer_id = mf.id
        LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0
        WHERE m.name LIKE ? 
           OR m.generic_name LIKE ? 
           OR m.category LIKE ?
        GROUP BY m.id
        ORDER BY m.name
      `,
        [`%${search}%`, `%${search}%`, `%${search}%`]
      );
    } else {
      // No search - get all medicines
      [medicines] = await db.query(`
        SELECT m.*, 
               mf.name as manufacturer_name,
               COALESCE(SUM(b.quantity), 0) as total_stock,
               COUNT(b.id) as batch_count
        FROM medicines m
        LEFT JOIN manufacturers mf ON m.manufacturer_id = mf.id
        LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0
        GROUP BY m.id
        ORDER BY m.name
      `);
    }

    // Get batches for each medicine
    for (let medicine of medicines) {
      const [batches] = await db.query(
        `
        SELECT b.*, s.name as supplier_name 
        FROM batches b
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE b.medicine_id = ? 
        ORDER BY b.expiry_date ASC
      `,
        [medicine.id]
      );
      medicine.batches = batches;
    }

    res.render("medicines/index", {
      medicines: medicines,
      search: search,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching medicines: " + error.message);
  }
};

// SHOW CREATE FORM
exports.createForm = async (req, res) => {
  try {
    const [manufacturers] = await db.query(
      "SELECT id, name FROM manufacturers ORDER BY name"
    );
    const [suppliers] = await db.query(
      "SELECT id, name FROM suppliers ORDER BY name"
    );

    res.render("medicines/create", {
      manufacturers: manufacturers || [],
      suppliers: suppliers || [],
    });
  } catch (error) {
    console.error(error);
    res.render("medicines/create", { manufacturers: [], suppliers: [] });
  }
};

// CREATE MEDICINE + BATCH + MANUFACTURER + SUPPLIER
exports.create = async (req, res) => {
  const {
    name,
    generic_name,
    category,
    unit,
    min_stock_level,
    manufacturer_id,
    new_manufacturer_name,
    new_manufacturer_email,
    new_manufacturer_phone,
    supplier_id,
    new_supplier_name,
    new_supplier_email,
    new_supplier_phone,
    new_supplier_address,
    batch_no,
    quantity,
    cost_price,
    selling_price,
    manufacture_date,
    expiry_date,
  } = req.body;

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Handle Manufacturer
    let finalManufacturerId =
      manufacturer_id && manufacturer_id !== "new" ? manufacturer_id : null;

    if (manufacturer_id === "new" && new_manufacturer_name) {
      const [manufacturerResult] = await conn.query(
        `INSERT INTO manufacturers (name, email, phone) VALUES (?, ?, ?)`,
        [
          new_manufacturer_name,
          new_manufacturer_email || null,
          new_manufacturer_phone || null,
        ]
      );
      finalManufacturerId = manufacturerResult.insertId;
    }

    // Handle Supplier
    let finalSupplierId =
      supplier_id && supplier_id !== "new" ? supplier_id : null;

    if (supplier_id === "new" && new_supplier_name) {
      const [supplierResult] = await conn.query(
        `INSERT INTO suppliers (name, email, phone, address) VALUES (?, ?, ?, ?)`,
        [
          new_supplier_name,
          new_supplier_email || null,
          new_supplier_phone || null,
          new_supplier_address || null,
        ]
      );
      finalSupplierId = supplierResult.insertId;
    }

    // Insert medicine
    const [medicineResult] = await conn.query(
      `INSERT INTO medicines (name, generic_name, category, unit, manufacturer_id, min_stock_level) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        generic_name || null,
        category || null,
        unit,
        finalManufacturerId,
        min_stock_level || 10,
      ]
    );

    const medicineId = medicineResult.insertId;

    // Insert batch
    await conn.query(
      `INSERT INTO batches 
       (medicine_id, supplier_id, batch_no, quantity, cost_price, selling_price, manufacture_date, expiry_date, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medicineId,
        finalSupplierId,
        batch_no,
        quantity,
        cost_price,
        selling_price,
        manufacture_date || null,
        expiry_date,
        req.session.user ? req.session.user.id : null,
      ]
    );

    await conn.commit();

    if (req.flash) req.flash("success", "Medicine created successfully!");
    res.redirect("/medicines");
  } catch (error) {
    await conn.rollback();
    console.error("Error creating medicine:", error);
    res.status(500).send("Error creating medicine: " + error.message);
  } finally {
    conn.release();
  }
};

// SHOW EDIT FORM
exports.editForm = async (req, res) => {
  const { id } = req.params;

  try {
    const [medicines] = await db.query("SELECT * FROM medicines WHERE id = ?", [
      id,
    ]);

    if (medicines.length === 0) {
      return res.status(404).send("Medicine not found");
    }

    const [manufacturers] = await db.query(
      "SELECT id, name FROM manufacturers ORDER BY name"
    );
    const [suppliers] = await db.query(
      "SELECT id, name FROM suppliers ORDER BY name"
    );
    const [batches] = await db.query(
      `
      SELECT b.*, s.name as supplier_name 
      FROM batches b
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.medicine_id = ? 
      ORDER BY b.expiry_date ASC
    `,
      [id]
    );

    res.render("medicines/edit", {
      medicine: medicines[0],
      manufacturers: manufacturers,
      suppliers: suppliers,
      batches: batches,
      success_msg: req.flash ? req.flash("success") : null,
      error_msg: req.flash ? req.flash("error") : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading edit form");
  }
};

// UPDATE MEDICINE INFO
exports.update = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    generic_name,
    category,
    unit,
    manufacturer_id,
    min_stock_level,
  } = req.body;

  try {
    await db.query(
      `UPDATE medicines 
       SET name = ?, generic_name = ?, category = ?, unit = ?, manufacturer_id = ?, min_stock_level = ?
       WHERE id = ?`,
      [
        name,
        generic_name || null,
        category || null,
        unit,
        manufacturer_id || null,
        min_stock_level,
        id,
      ]
    );

    if (req.flash) req.flash("success", "Medicine updated successfully");
    res.redirect("/medicines");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating medicine: " + error.message);
  }
};

// DELETE MEDICINE
exports.delete = async (req, res) => {
  const { id } = req.params;

  try {
    const [batches] = await db.query(
      "SELECT COUNT(*) as count FROM batches WHERE medicine_id = ?",
      [id]
    );

    if (batches[0].count > 0) {
      if (req.flash) {
        req.flash(
          "error",
          "Cannot delete medicine with existing stock batches."
        );
        return res.redirect("/medicines");
      }
      return res.send("Cannot delete medicine with existing stock batches.");
    }

    await db.query("DELETE FROM medicines WHERE id = ?", [id]);
    if (req.flash) req.flash("success", "Medicine deleted successfully");
    res.redirect("/medicines");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting medicine");
  }
};

// ==================== BATCH OPERATIONS ====================

// ADD NEW BATCH
exports.addBatch = async (req, res) => {
  const { medicineId } = req.params;
  const {
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
       (medicine_id, supplier_id, batch_no, quantity, cost_price, selling_price, manufacture_date, expiry_date, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medicineId,
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
    res.redirect(`/medicines/edit/${medicineId}`);
  } catch (error) {
    console.error(error);
    if (req.flash) req.flash("error", "Error adding batch: " + error.message);
    res.redirect(`/medicines/edit/${medicineId}`);
  }
};

// EDIT BATCH
exports.editBatch = async (req, res) => {
  const { batchId } = req.params;
  const {
    supplier_id,
    batch_no,
    quantity,
    cost_price,
    selling_price,
    manufacture_date,
    expiry_date,
  } = req.body;

  try {
    const [batches] = await db.query(
      "SELECT medicine_id FROM batches WHERE id = ?",
      [batchId]
    );

    if (batches.length === 0) {
      if (req.flash) req.flash("error", "Batch not found");
      return res.redirect("/medicines");
    }

    await db.query(
      `UPDATE batches 
       SET supplier_id = ?, batch_no = ?, quantity = ?, cost_price = ?, selling_price = ?, manufacture_date = ?, expiry_date = ?
       WHERE id = ?`,
      [
        supplier_id || null,
        batch_no,
        quantity,
        cost_price,
        selling_price,
        manufacture_date || null,
        expiry_date,
        batchId,
      ]
    );

    if (req.flash) req.flash("success", "Batch updated successfully!");
    res.redirect(`/medicines/edit/${batches[0].medicine_id}`);
  } catch (error) {
    console.error(error);
    if (req.flash) req.flash("error", "Error updating batch: " + error.message);
    res.redirect("/medicines");
  }
};

// DELETE BATCH
exports.deleteBatch = async (req, res) => {
  const { batchId } = req.params;

  try {
    const [batches] = await db.query(
      "SELECT medicine_id, quantity FROM batches WHERE id = ?",
      [batchId]
    );

    if (batches.length === 0) {
      if (req.flash) req.flash("error", "Batch not found");
      return res.redirect("/medicines");
    }

    const medicineId = batches[0].medicine_id;

    // Check if batch has been used in sales
    const [sales] = await db.query(
      "SELECT COUNT(*) as count FROM sale_items WHERE batch_id = ?",
      [batchId]
    );

    if (sales[0].count > 0) {
      if (req.flash)
        req.flash("error", "Cannot delete batch that has been sold.");
      return res.redirect(`/medicines/edit/${medicineId}`);
    }

    await db.query("DELETE FROM batches WHERE id = ?", [batchId]);

    if (req.flash) req.flash("success", "Batch deleted successfully!");
    res.redirect(`/medicines/edit/${medicineId}`);
  } catch (error) {
    console.error(error);
    if (req.flash) req.flash("error", "Error deleting batch: " + error.message);
    res.redirect("/medicines");
  }
};

// GET BATCH DETAILS (for AJAX)
exports.getBatchDetails = async (req, res) => {
  const { batchId } = req.params;

  try {
    const [batches] = await db.query(
      `SELECT b.*, s.name as supplier_name 
       FROM batches b
       LEFT JOIN suppliers s ON b.supplier_id = s.id
       WHERE b.id = ?`,
      [batchId]
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

// UPDATE BATCH QUANTITY
exports.updateBatchQuantity = async (req, res) => {
  const { batchId } = req.params;
  const { quantity } = req.body;

  try {
    const [batches] = await db.query(
      "SELECT medicine_id FROM batches WHERE id = ?",
      [batchId]
    );

    if (batches.length === 0) {
      if (req.flash) req.flash("error", "Batch not found");
      return res.redirect("/medicines");
    }

    await db.query("UPDATE batches SET quantity = ? WHERE id = ?", [
      quantity,
      batchId,
    ]);

    if (req.flash) req.flash("success", "Batch quantity updated successfully!");
    res.redirect(`/medicines/edit/${batches[0].medicine_id}`);
  } catch (error) {
    console.error(error);
    if (req.flash)
      req.flash("error", "Error updating quantity: " + error.message);
    res.redirect("/medicines");
  }
};
