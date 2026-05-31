const db = require("../config/db");

// ============ HELPER FUNCTION: FEFO BATCH SELECTION ============
const getBatchesByFEFO = async (medicineId, requestedQuantity) => {
  const [batches] = await db.query(
    `
      SELECT id, batch_no, quantity, selling_price, cost_price, expiry_date
      FROM batches
      WHERE medicine_id = ? AND quantity > 0 AND expiry_date > CURDATE()
      ORDER BY expiry_date ASC
    `,
    [medicineId]
  );

  // Calculate which batches to use
  let remainingQty = requestedQuantity;
  const selectedBatches = [];

  for (const batch of batches) {
    if (remainingQty <= 0) break;

    const takeQty = Math.min(batch.quantity, remainingQty);
    selectedBatches.push({
      id: batch.id,
      batch_no: batch.batch_no,
      quantity: takeQty,
      selling_price: batch.selling_price,
      cost_price: batch.cost_price,
      expiry_date: batch.expiry_date,
    });
    remainingQty -= takeQty;
  }

  if (remainingQty > 0) {
    throw new Error(
      `Insufficient stock. Only ${
        requestedQuantity - remainingQty
      } units available`
    );
  }

  return selectedBatches;
};

// Add to cart with FEFO (automatic batch selection)
exports.addToCartFEFO = async (req, res) => {
  const { sale_id, medicine_id, quantity } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get batches ordered by expiry (earliest first) - FEFO
    // IMPORTANT: Only get batches that are NOT expired (expiry_date > CURDATE())
    const [batches] = await connection.query(
      `
        SELECT id, batch_no, quantity, selling_price, cost_price, expiry_date
        FROM batches
        WHERE medicine_id = ? AND quantity > 0 AND expiry_date > CURDATE()
        ORDER BY expiry_date ASC
      `,
      [medicine_id]
    );

    if (batches.length === 0) {
      throw new Error("No available stock for this medicine");
    }

    // Calculate which batches to use (FEFO logic)
    let remainingQty = parseInt(quantity);
    const selectedBatches = [];

    for (const batch of batches) {
      if (remainingQty <= 0) break;

      const takeQty = Math.min(batch.quantity, remainingQty);
      selectedBatches.push({
        id: batch.id,
        batch_no: batch.batch_no,
        quantity: takeQty,
        selling_price: batch.selling_price,
        cost_price: batch.cost_price,
        expiry_date: batch.expiry_date,
      });
      remainingQty -= takeQty;
    }

    if (remainingQty > 0) {
      throw new Error(
        `Insufficient stock. Only ${quantity - remainingQty} units available`
      );
    }

    let totalSubtotal = 0;
    let totalProfit = 0;

    // Create sale_items for each batch needed
    for (const batch of selectedBatches) {
      const subtotal = batch.quantity * batch.selling_price;
      const profit = batch.quantity * (batch.selling_price - batch.cost_price);
      totalSubtotal += subtotal;
      totalProfit += profit;

      await connection.query(
        `
          INSERT INTO sale_items (sale_id, batch_id, quantity, selling_price, cost_price, subtotal, profit)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          sale_id,
          batch.id,
          batch.quantity,
          batch.selling_price,
          batch.cost_price,
          subtotal,
          profit,
        ]
      );
    }

    // Update sale totals
    await connection.query(
      `
        UPDATE sales 
        SET total_amount = total_amount + ?,
            total_profit = total_profit + ?
        WHERE id = ?
      `,
      [totalSubtotal, totalProfit, sale_id]
    );

    await connection.commit();

    req.flash(
      "success",
      `${quantity} units added to cart (FEFO applied - oldest stock first)`
    );
    res.redirect("/pos/pharmacist");
  } catch (error) {
    await connection.rollback();
    console.error("Error adding to cart:", error);
    req.flash("error", error.message || "Error adding to cart");
    res.redirect("/pos/pharmacist");
  } finally {
    connection.release();
  }
};

// ============ DASHBOARD FUNCTIONS ============

// Pharmacist dashboard (initial page load)
exports.pharmacistDashboard = async (req, res) => {
  try {
    // Get today's completed sales
    const [todaySales] = await db.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
      FROM sales 
      WHERE status = 'completed' AND DATE(completed_at) = CURDATE()
    `);

    // Get pending sales count
    const [pendingSales] = await db.query(`
      SELECT COUNT(*) as count
      FROM sales 
      WHERE status = 'pending'
    `);

    res.render("pos/pharmacist", {
      user: req.session.user,
      todaySales: todaySales[0],
      pendingCount: pendingSales[0].count || 0,
      error_msg: req.flash("error"),
      success_msg: req.flash("success"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading pharmacist dashboard");
  }
};

// Cashier dashboard
exports.cashierDashboard = async (req, res) => {
  try {
    // Get pending sales (sent to cashier)
    const [pendingSales] = await db.query(`
      SELECT s.*, 
             u.name as pharmacist_name,
             COUNT(si.id) as item_count,
             GROUP_CONCAT(
               DISTINCT CONCAT(si.quantity, 'x ', m.name, ' (', m.unit, ')') 
               SEPARATOR ', '
             ) as items_summary
      FROM sales s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN batches b ON si.batch_id = b.id
      LEFT JOIN medicines m ON b.medicine_id = m.id
      WHERE s.status = 'pending'
      GROUP BY s.id
      ORDER BY s.sent_to_cashier_at ASC
    `);

    // Get today's completed sales by this cashier
    const [todaySales] = await db.query(
      `
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
      FROM sales 
      WHERE status = 'completed' 
        AND completed_by = ? 
        AND DATE(completed_at) = CURDATE()
    `,
      [req.session.user.id]
    );

    res.render("pos/cashier", {
      user: req.session.user,
      pendingSales: pendingSales,
      todaySales: todaySales[0],
      error_msg: req.flash("error"),
      success_msg: req.flash("success"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading cashier dashboard");
  }
};

// ============ MEDICINE & BATCH FUNCTIONS ============

// Get all medicines (for the list view)
// IMPORTANT: Only show medicines with available stock (non-expired batches)
// Get all medicines (for the list view) - EXCLUDE expired ones
exports.getAllMedicines = async (req, res) => {
  try {
    const [medicines] = await db.query(`
      SELECT DISTINCT m.id, m.name, m.generic_name, m.unit, m.min_stock_level,
             mf.name as manufacturer_name,
             COALESCE(SUM(b.quantity), 0) as total_stock,
             MIN(b.selling_price) as selling_price,
             MIN(b.expiry_date) as earliest_expiry
      FROM medicines m
      LEFT JOIN manufacturers mf ON m.manufacturer_id = mf.id
      LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0 AND b.expiry_date > CURDATE()
      GROUP BY m.id
      HAVING total_stock > 0
      ORDER BY m.name
    `);
    res.json(medicines);
  } catch (error) {
    console.error("Error fetching medicines:", error);
    res.status(500).json({ error: "Error fetching medicines" });
  }
};

// Search medicines
// IMPORTANT: Only show medicines with available stock (non-expired batches)
exports.searchMedicines = async (req, res) => {
  const search = req.query.search;
  try {
    const [medicines] = await db.query(
      `
      SELECT DISTINCT m.id, m.name, m.generic_name, m.unit, m.min_stock_level,
             mf.name as manufacturer_name,
             COALESCE(SUM(b.quantity), 0) as total_stock,
             MIN(b.selling_price) as selling_price
      FROM medicines m
      LEFT JOIN manufacturers mf ON m.manufacturer_id = mf.id
      LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0 AND b.expiry_date > CURDATE()
      WHERE m.name LIKE ? OR m.generic_name LIKE ? OR m.category LIKE ?
      GROUP BY m.id
      HAVING total_stock > 0
      ORDER BY m.name
      LIMIT 50
    `,
      ["%" + search + "%", "%" + search + "%", "%" + search + "%"]
    );
    res.json(medicines);
  } catch (error) {
    console.error("Error searching medicines:", error);
    res.status(500).json({ error: "Error searching medicines" });
  }
};

// Get available batches for a medicine (for debugging/admin)
exports.getMedicineBatches = async (req, res) => {
  const { medicineId } = req.params;
  try {
    const [batches] = await db.query(
      `
      SELECT b.id, b.batch_no, b.quantity, b.selling_price, b.expiry_date
      FROM batches b
      WHERE b.medicine_id = ? AND b.quantity > 0 AND b.expiry_date > CURDATE()
      ORDER BY b.expiry_date ASC
    `,
      [medicineId]
    );
    res.json(batches);
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ error: "Error fetching batches" });
  }
};

// ============ SALE / CART FUNCTIONS ============

// Create draft sale via AJAX
exports.createDraftSaleAjax = async (req, res) => {
  try {
    const [result] = await db.query(
      `
      INSERT INTO sales (user_id, total_amount, total_profit, status)
      VALUES (?, 0, 0, 'draft')
    `,
      [req.session.user.id]
    );

    res.json({ success: true, sale_id: result.insertId });
  } catch (error) {
    console.error("Error creating draft sale:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add item to cart (legacy - kept for compatibility)
exports.addToCart = async (req, res) => {
  const { sale_id, batch_id, quantity } = req.body;

  try {
    // Get batch details
    const [batches] = await db.query(
      `
      SELECT b.*, m.name as medicine_name, m.unit
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      WHERE b.id = ? AND b.quantity >= ? AND b.expiry_date > CURDATE()
    `,
      [batch_id, quantity]
    );

    if (batches.length === 0) {
      req.flash("error", "Insufficient stock or batch not found");
      return res.redirect("/pos/pharmacist");
    }

    const batch = batches[0];
    const subtotal = quantity * batch.selling_price;
    const profit = quantity * (batch.selling_price - batch.cost_price);

    // Add to sale_items
    await db.query(
      `
      INSERT INTO sale_items (sale_id, batch_id, quantity, selling_price, cost_price, subtotal, profit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        sale_id,
        batch_id,
        quantity,
        batch.selling_price,
        batch.cost_price,
        subtotal,
        profit,
      ]
    );

    // Update sale totals
    await db.query(
      `
      UPDATE sales 
      SET total_amount = COALESCE((SELECT SUM(subtotal) FROM sale_items WHERE sale_id = ?), 0),
          total_profit = COALESCE((SELECT SUM(profit) FROM sale_items WHERE sale_id = ?), 0)
      WHERE id = ?
    `,
      [sale_id, sale_id, sale_id]
    );

    req.flash(
      "success",
      quantity + "x " + batch.medicine_name + " added to cart"
    );
    res.redirect("/pos/pharmacist");
  } catch (error) {
    console.error("Error adding to cart:", error);
    req.flash("error", "Error adding to cart");
    res.redirect("/pos/pharmacist");
  }
};

// Remove item from cart
exports.removeFromCart = async (req, res) => {
  const { item_id, sale_id } = req.params;

  try {
    await db.query("DELETE FROM sale_items WHERE id = ?", [item_id]);

    // Update sale totals
    await db.query(
      `
      UPDATE sales 
      SET total_amount = COALESCE((SELECT SUM(subtotal) FROM sale_items WHERE sale_id = ?), 0),
          total_profit = COALESCE((SELECT SUM(profit) FROM sale_items WHERE sale_id = ?), 0)
      WHERE id = ?
    `,
      [sale_id, sale_id, sale_id]
    );

    req.flash("success", "Item removed from cart");
    res.redirect("/pos/pharmacist");
  } catch (error) {
    console.error("Error removing from cart:", error);
    req.flash("error", "Error removing item");
    res.redirect("/pos/pharmacist");
  }
};

// Complete sale (pharmacist does payment) - STOCK DEDUCTED HERE
// Complete sale (pharmacist does payment) - WITH payment_method
exports.completeSale = async (req, res) => {
  const { sale_id } = req.params;
  const { payment_method } = req.body; // ← THIS WAS MISSING

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get sale items - only valid batches (non-expired)
    const [items] = await connection.query(
      `
      SELECT si.*, b.quantity as stock_quantity, b.expiry_date
      FROM sale_items si
      JOIN batches b ON si.batch_id = b.id
      WHERE si.sale_id = ? AND b.expiry_date > CURDATE()
    `,
      [sale_id]
    );

    if (items.length === 0) {
      throw new Error("No valid items in this sale (some may be expired)");
    }

    // Check stock availability
    for (let i = 0; i < items.length; i++) {
      if (items[i].stock_quantity < items[i].quantity) {
        throw new Error("Insufficient stock for batch " + items[i].batch_id);
      }
    }

    // Deduct stock from batches
    for (let i = 0; i < items.length; i++) {
      await connection.query(
        `
        UPDATE batches SET quantity = quantity - ? WHERE id = ?
      `,
        [items[i].quantity, items[i].batch_id]
      );
    }

    // Update sale status WITH PAYMENT METHOD
    await connection.query(
      `
      UPDATE sales 
      SET status = 'completed', 
          completed_by = ?,
          completed_at = NOW(),
          payment_method = ?
      WHERE id = ?
    `,
      [req.session.user.id, payment_method || "cash", sale_id] // ← ADDED payment_method
    );

    await connection.commit();

    req.flash("success", "Sale completed successfully!");
    res.redirect("/pos/receipt/" + sale_id);
  } catch (error) {
    await connection.rollback();
    console.error("Error completing sale:", error);
    req.flash("error", error.message || "Error completing sale");
    res.redirect("/pos/pharmacist");
  } finally {
    connection.release();
  }
};

// Send sale to cashier (NO stock deduction)
exports.sendToCashier = async (req, res) => {
  const { sale_id } = req.params;

  try {
    // Check if sale has items
    const [items] = await db.query(
      `
      SELECT COUNT(*) as count FROM sale_items si
      JOIN batches b ON si.batch_id = b.id
      WHERE si.sale_id = ? AND b.expiry_date > CURDATE()
    `,
      [sale_id]
    );

    if (items[0].count === 0) {
      req.flash("error", "Cannot send empty sale to cashier");
      return res.redirect("/pos/pharmacist");
    }

    await db.query(
      `
      UPDATE sales 
      SET status = 'pending',
          sent_to_cashier_at = NOW(),
          sent_by = ?
      WHERE id = ? AND status = 'draft'
    `,
      [req.session.user.id, sale_id]
    );

    req.flash(
      "success",
      "Sale sent to cashier. Stock will be deducted when payment is completed."
    );
    res.redirect("/pos/pharmacist");
  } catch (error) {
    console.error("Error sending to cashier:", error);
    req.flash("error", "Error sending to cashier");
    res.redirect("/pos/pharmacist");
  }
};

// Cancel draft or pending sale
exports.cancelSale = async (req, res) => {
  const { sale_id } = req.params;

  try {
    await db.query("DELETE FROM sale_items WHERE sale_id = ?", [sale_id]);
    await db.query(
      "DELETE FROM sales WHERE id = ? AND status IN ('draft', 'pending')",
      [sale_id]
    );

    req.flash("success", "Sale cancelled");
    res.redirect("/pos/pharmacist");
  } catch (error) {
    console.error("Error cancelling sale:", error);
    req.flash("error", "Error cancelling sale");
    res.redirect("/pos/pharmacist");
  }
};

// ============ CASHIER FUNCTIONS ============

// Get sale details for cashier (modal view)
exports.getSaleDetails = async (req, res) => {
  const { sale_id } = req.params;

  try {
    const [sales] = await db.query(
      `
      SELECT s.*, u.name as pharmacist_name
      FROM sales s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `,
      [sale_id]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: "Sale not found" });
    }

    const [items] = await db.query(
      `
      SELECT si.*, b.batch_no, m.name as medicine_name, m.unit
      FROM sale_items si
      JOIN batches b ON si.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      WHERE si.sale_id = ?
    `,
      [sale_id]
    );

    res.json({
      sale: sales[0],
      items: items,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching sale details" });
  }
};

// Confirm payment (cashier) - THIS IS WHERE STOCK IS DEDUCTED
// Confirm payment (cashier) - WITH payment_method
exports.confirmPayment = async (req, res) => {
  const { sale_id } = req.params;
  const { payment_method } = req.body; // ← ADD THIS

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Check if sale is still pending
    const [sales] = await connection.query(
      `
      SELECT status FROM sales WHERE id = ? FOR UPDATE
    `,
      [sale_id]
    );

    if (sales.length === 0 || sales[0].status !== "pending") {
      throw new Error("Sale is no longer pending");
    }

    // Get sale items - only valid batches (non-expired)
    const [items] = await connection.query(
      `
      SELECT si.*, b.quantity as stock_quantity, b.expiry_date
      FROM sale_items si
      JOIN batches b ON si.batch_id = b.id
      WHERE si.sale_id = ? AND b.expiry_date > CURDATE()
    `,
      [sale_id]
    );

    if (items.length === 0) {
      throw new Error("No valid items in this sale (some may be expired)");
    }

    // DEDUCT STOCK FROM BATCHES (NOW!)
    for (let i = 0; i < items.length; i++) {
      const [result] = await connection.query(
        `
        UPDATE batches 
        SET quantity = quantity - ? 
        WHERE id = ? AND quantity >= ?
      `,
        [items[i].quantity, items[i].batch_id, items[i].quantity]
      );

      if (result.affectedRows === 0) {
        throw new Error("Insufficient stock for one or more items");
      }
    }

    // Update sale status WITH PAYMENT METHOD
    await connection.query(
      `
      UPDATE sales 
      SET status = 'completed',
          completed_by = ?,
          completed_at = NOW(),
          payment_method = ?
      WHERE id = ?
    `,
      [req.session.user.id, payment_method || "cash", sale_id] // ← ADDED payment_method
    );

    await connection.commit();

    req.flash("success", "Payment confirmed! Stock deducted.");
    res.redirect("/pos/receipt/" + sale_id);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    req.flash("error", error.message || "Error processing payment");
    res.redirect("/pos/cashier");
  } finally {
    connection.release();
  }
};

// ============ RECEIPT FUNCTIONS ============

// Print receipt
exports.printReceipt = async (req, res) => {
  const { sale_id } = req.params;

  try {
    const [sales] = await db.query(
      `
      SELECT s.*, 
             u.name as pharmacist_name,
             c.name as cashier_name
      FROM sales s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN users c ON s.completed_by = c.id
      WHERE s.id = ? AND s.status = 'completed'
    `,
      [sale_id]
    );

    if (sales.length === 0) {
      return res.status(404).send("Sale not found");
    }

    const [items] = await db.query(
      `
      SELECT si.*, b.batch_no, m.name as medicine_name, m.unit
      FROM sale_items si
      JOIN batches b ON si.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      WHERE si.sale_id = ?
    `,
      [sale_id]
    );

    res.render("pos/receipt", {
      sale: sales[0],
      items: items,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Error printing receipt:", error);
    res.status(500).send("Error printing receipt");
  }
};

// ============ ACTIVE SALES & HISTORY FUNCTIONS ============

// Get all active sales (draft and pending) for pharmacist
exports.getActiveSales = async (req, res) => {
  try {
    const [sales] = await db.query(
      `
      SELECT s.*, 
             COUNT(si.id) as item_count,
             SUM(si.quantity) as total_quantity,
             GROUP_CONCAT(
               CONCAT(si.quantity, 'x ', m.name) SEPARATOR ', '
             ) as items_summary
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN batches b ON si.batch_id = b.id
      LEFT JOIN medicines m ON b.medicine_id = m.id
      WHERE s.user_id = ? AND s.status IN ('draft', 'pending')
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `,
      [req.session.user.id]
    );

    res.json(sales);
  } catch (error) {
    console.error("Error fetching active sales:", error);
    res
      .status(500)
      .json({ error: "Error fetching active sales", details: error.message });
  }
};

// Get sales history (completed sales)
exports.getSalesHistory = async (req, res) => {
  try {
    const [sales] = await db.query(
      `
      SELECT s.*, 
             u.name as pharmacist_name,
             c.name as completed_by_name,
             COUNT(si.id) as item_count,
             GROUP_CONCAT(
               DISTINCT CONCAT(si.quantity, 'x ', m.name) SEPARATOR ', '
             ) as items_summary
      FROM sales s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN users c ON s.completed_by = c.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN batches b ON si.batch_id = b.id
      LEFT JOIN medicines m ON b.medicine_id = m.id
      WHERE s.user_id = ? AND s.status = 'completed'
      GROUP BY s.id
      ORDER BY s.completed_at DESC
      LIMIT 50
    `,
      [req.session.user.id]
    );

    res.json(sales);
  } catch (error) {
    console.error("Error fetching sales history:", error);
    res
      .status(500)
      .json({ error: "Error fetching sales history", details: error.message });
  }
};
