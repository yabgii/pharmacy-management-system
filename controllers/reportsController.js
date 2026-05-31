const db = require("../config/db");

// REPORTS DASHBOARD - Detailed Analytics
// ============ REPORTS DASHBOARD - Detailed Analytics ============
exports.index = async (req, res) => {
  try {
    // ========== 1. STOCK SUMMARY ==========
    const [stockSummary] = await db.query(`
      SELECT 
        COUNT(DISTINCT m.id) as total_medicines,
        COUNT(b.id) as total_batches,
        COALESCE(SUM(b.quantity), 0) as total_units_in_stock,
        COALESCE(SUM(b.quantity * b.cost_price), 0) as total_investment_cost,
        COALESCE(SUM(b.quantity * b.selling_price), 0) as total_potential_revenue,
        COALESCE(SUM(b.quantity * (b.selling_price - b.cost_price)), 0) as total_potential_profit
      FROM medicines m
      LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0
    `);

    // ========== 2. EXPIRY SUMMARY ==========
    const [expirySummary] = await db.query(`
      SELECT 
        SUM(CASE WHEN expiry_date < CURDATE() AND quantity > 0 THEN quantity ELSE 0 END) as expired_units,
        SUM(CASE WHEN expiry_date < CURDATE() AND quantity > 0 THEN quantity * cost_price ELSE 0 END) as expired_value,
        SUM(CASE WHEN expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND quantity > 0 THEN quantity ELSE 0 END) as expiring_30_units,
        SUM(CASE WHEN expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND quantity > 0 THEN quantity * cost_price ELSE 0 END) as expiring_30_value,
        SUM(CASE WHEN expiry_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY) AND DATE_ADD(CURDATE(), INTERVAL 90 DAY) AND quantity > 0 THEN quantity ELSE 0 END) as expiring_90_units,
        SUM(CASE WHEN expiry_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY) AND DATE_ADD(CURDATE(), INTERVAL 90 DAY) AND quantity > 0 THEN quantity * cost_price ELSE 0 END) as expiring_90_value,
        COUNT(DISTINCT CASE WHEN expiry_date < CURDATE() AND quantity > 0 THEN b.id END) as expired_batches,
        COUNT(DISTINCT CASE WHEN expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND quantity > 0 THEN b.id END) as expiring_30_batches
      FROM batches b
    `);

    // ========== 3. LOW STOCK ALERTS ==========
    const [lowStockItems] = await db.query(`
      SELECT 
        m.id,
        m.name,
        m.unit,
        m.min_stock_level,
        COALESCE(SUM(b.quantity), 0) as current_stock,
        (m.min_stock_level - COALESCE(SUM(b.quantity), 0)) as needed_quantity
      FROM medicines m
      LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0 AND b.expiry_date > CURDATE()
      GROUP BY m.id
      HAVING current_stock <= min_stock_level AND current_stock > 0
      ORDER BY current_stock ASC
      LIMIT 10
    `);

    // ========== 4. OUT OF STOCK ITEMS ==========
    const [outOfStockItems] = await db.query(`
      SELECT 
        m.id,
        m.name,
        m.unit,
        m.min_stock_level,
        COALESCE(SUM(b.quantity), 0) as current_stock
      FROM medicines m
      LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0 AND b.expiry_date > CURDATE()
      GROUP BY m.id
      HAVING current_stock = 0
      ORDER BY m.name
      LIMIT 10
    `);

    // ========== 5. RECENT EXPIRED BATCHES ==========
    const [recentExpired] = await db.query(`
      SELECT 
        b.id,
        b.batch_no,
        b.quantity,
        b.cost_price,
        b.expiry_date,
        m.name as medicine_name,
        m.unit,
        s.name as supplier_name
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.expiry_date < CURDATE() AND b.quantity > 0
      ORDER BY b.expiry_date DESC
      LIMIT 10
    `);

    // ========== 6. SALES SUMMARY ==========
    const [todaySales] = await db.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(total_profit), 0) as profit,
        COUNT(*) as transactions
      FROM sales
      WHERE DATE(created_at) = CURDATE() AND status = 'completed'
    `);

    const [monthSales] = await db.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(total_profit), 0) as profit,
        COUNT(*) as transactions
      FROM sales
      WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) AND status = 'completed'
    `);

    // ========== 7. WEEKLY SALES TREND ==========
    const [weeklyTrend] = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(total_profit), 0) as profit,
        COUNT(*) as transactions
      FROM sales
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // ========== 8. TOP SELLING MEDICINES ==========
    const [topSelling] = await db.query(`
      SELECT 
        m.name,
        m.unit,
        SUM(si.quantity) as total_sold,
        SUM(si.subtotal) as total_revenue,
        SUM(si.profit) as total_profit
      FROM sale_items si
      JOIN batches b ON si.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      JOIN sales s ON si.sale_id = s.id
      WHERE MONTH(s.created_at) = MONTH(CURDATE()) AND YEAR(s.created_at) = YEAR(CURDATE())
      GROUP BY b.medicine_id, m.name, m.unit
      ORDER BY total_sold DESC
      LIMIT 5
    `);

    // ========== 9. PROFIT MARGIN ANALYSIS ==========
    const [marginAnalysis] = await db.query(`
      SELECT 
        AVG((selling_price - cost_price) / selling_price * 100) as avg_margin_percent
      FROM batches
      WHERE selling_price > 0 AND quantity > 0
    `);

    let avgMargin = 0;
    if (marginAnalysis[0] && marginAnalysis[0].avg_margin_percent !== null) {
      avgMargin = parseFloat(marginAnalysis[0].avg_margin_percent);
    }
    if (isNaN(avgMargin)) avgMargin = 0;

    // ========== 10. RECENT ACTIVITIES ==========
    const [recentSales] = await db.query(`
      SELECT 
        'sale' as type,
        s.id as reference_id,
        s.created_at as date,
        u.name as user_name,
        CONCAT('Sale #', s.id, ' - ETB ', FORMAT(s.total_amount, 0)) as description
      FROM sales s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
      LIMIT 5
    `);

    const [recentBatches] = await db.query(`
      SELECT 
        'batch_in' as type,
        b.id as reference_id,
        b.created_at as date,
        COALESCE(u.name, 'System') as user_name,
        CONCAT('Stock added: ', b.batch_no, ' - ', m.name, ' (', b.quantity, ' ', m.unit, ')') as description
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      LEFT JOIN users u ON b.created_by = u.id
      ORDER BY b.created_at DESC
      LIMIT 5
    `);

    let recentActivities = [...recentSales, ...recentBatches];
    recentActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
    recentActivities = recentActivities.slice(0, 10);

    // ========== 11. DEAD STOCK REPORT (New) ==========
    const [deadStock] = await db.query(`
      SELECT 
        m.id,
        m.name,
        m.category,
        m.unit,
        COALESCE(SUM(b.quantity), 0) as stock_quantity,
        COALESCE(SUM(b.quantity * b.cost_price), 0) as capital_tied_up,
        COALESCE(MAX(s.created_at), 'Never Sold') as last_sale_date,
        DATEDIFF(NOW(), COALESCE(MAX(s.created_at), '1900-01-01')) as days_since_last_sale
      FROM medicines m
      JOIN batches b ON m.id = b.medicine_id
      LEFT JOIN sale_items si ON b.id = si.batch_id
      LEFT JOIN sales s ON si.sale_id = s.id
      WHERE b.quantity > 0
      GROUP BY m.id
      HAVING last_sale_date = 'Never Sold' OR days_since_last_sale > 90
      ORDER BY capital_tied_up DESC
      LIMIT 10
    `);

    // Calculate dead stock total
    let deadStockTotal = 0;
    for (let i = 0; i < deadStock.length; i++) {
      deadStockTotal += parseFloat(deadStock[i].capital_tied_up || 0);
    }

    // ========== 12. PEAK HOURS REPORT (New) ==========
    const [peakHours] = await db.query(`
      SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as transactions,
        SUM(total_amount) as revenue,
        ROUND(AVG(total_amount), 2) as avg_transaction_value
      FROM sales
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND status = 'completed'
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC
    `);

    // ========== 13. PAYMENT METHODS BREAKDOWN (New) ==========
    const [paymentBreakdown] = await db.query(`
      SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_amount,
        ROUND(AVG(total_amount), 2) as avg_amount,
        ROUND((SUM(total_amount) / (SELECT SUM(total_amount) FROM sales WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) AND status = 'completed') * 100), 2) as percentage
      FROM sales
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND status = 'completed'
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `);

    // ========== 14. TODAY'S PAYMENT TOTAL ==========
    const [todayPaymentTotal] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM sales
      WHERE DATE(created_at) = CURDATE() AND status = 'completed'
    `);

    res.render("reports/index", {
      user: req.session.user,
      totalUnits: stockSummary[0].total_units_in_stock || 0,
      totalInvestment: stockSummary[0].total_investment_cost || 0,
      totalPotentialRevenue: stockSummary[0].total_potential_revenue || 0,
      totalPotentialProfit: stockSummary[0].total_potential_profit || 0,
      expiredBatches: expirySummary[0].expired_batches || 0,
      expiredValue: expirySummary[0].expired_value || 0,
      expiring30Batches: expirySummary[0].expiring_30_batches || 0,
      expiring30Value: expirySummary[0].expiring_30_value || 0,
      lowStockItems: lowStockItems,
      outOfStockItems: outOfStockItems,
      recentExpired: recentExpired,
      todayRevenue: todaySales[0].revenue || 0,
      todayProfit: todaySales[0].profit || 0,
      monthRevenue: monthSales[0].revenue || 0,
      monthProfit: monthSales[0].profit || 0,
      weeklyTrend: weeklyTrend,
      topSelling: topSelling,
      avgMargin: avgMargin,
      recentActivities: recentActivities,
      // New variables
      deadStock: deadStock,
      deadStockTotal: deadStockTotal,
      peakHours: peakHours,
      paymentBreakdown: paymentBreakdown,
      todayPaymentTotal: todayPaymentTotal[0].total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading reports: " + error.message);
  }
};

// EXPORT REPORTS TO CSV
exports.exportCSV = async (req, res) => {
  try {
    // Fetch all the data
    const [stockSummary] = await db.query(`
      SELECT 
        COUNT(DISTINCT m.id) as total_medicines,
        COUNT(b.id) as total_batches,
        COALESCE(SUM(b.quantity), 0) as total_units_in_stock,
        COALESCE(SUM(b.quantity * b.cost_price), 0) as total_investment_cost,
        COALESCE(SUM(b.quantity * b.selling_price), 0) as total_potential_revenue,
        COALESCE(SUM(b.quantity * (b.selling_price - b.cost_price)), 0) as total_potential_profit
      FROM medicines m
      LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0
    `);

    const [expirySummary] = await db.query(`
      SELECT 
        SUM(CASE WHEN expiry_date < CURDATE() AND quantity > 0 THEN quantity ELSE 0 END) as expired_units,
        SUM(CASE WHEN expiry_date < CURDATE() AND quantity > 0 THEN quantity * cost_price ELSE 0 END) as expired_value,
        SUM(CASE WHEN expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND quantity > 0 THEN quantity ELSE 0 END) as expiring_30_units,
        SUM(CASE WHEN expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND quantity > 0 THEN quantity * cost_price ELSE 0 END) as expiring_30_value
      FROM batches b
    `);

    const [lowStockItems] = await db.query(`
      SELECT 
        m.name,
        m.unit,
        m.min_stock_level,
        COALESCE(SUM(b.quantity), 0) as current_stock,
        (m.min_stock_level - COALESCE(SUM(b.quantity), 0)) as needed_quantity
      FROM medicines m
      LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0
      GROUP BY m.id
      HAVING current_stock <= min_stock_level
      ORDER BY current_stock ASC
    `);

    const [topSelling] = await db.query(`
      SELECT 
        m.name,
        m.unit,
        SUM(si.quantity) as total_sold,
        SUM(si.subtotal) as total_revenue,
        SUM(si.profit) as total_profit
      FROM sale_items si
      JOIN batches b ON si.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      JOIN sales s ON si.sale_id = s.id
      WHERE MONTH(s.created_at) = MONTH(CURDATE()) AND YEAR(s.created_at) = YEAR(CURDATE())
      GROUP BY b.medicine_id, m.name, m.unit
      ORDER BY total_sold DESC
      LIMIT 10
    `);

    const [recentExpired] = await db.query(`
      SELECT 
        m.name as medicine_name,
        b.batch_no,
        b.quantity,
        b.expiry_date,
        (b.quantity * b.cost_price) as loss_value
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      WHERE b.expiry_date < CURDATE() AND b.quantity > 0
      ORDER BY b.expiry_date DESC
      LIMIT 50
    `);

    const [weeklySales] = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transactions,
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(total_profit), 0) as profit
      FROM sales
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Create CSV content as an array
    const csvRows = [];

    // Title and timestamp
    csvRows.push(`"Pharmacy Management System - Complete Report"`);
    csvRows.push(`"Generated on: ${new Date().toLocaleString()}"`);
    csvRows.push(``);

    // 1. STOCK SUMMARY
    csvRows.push(`"=== STOCK SUMMARY ==="`);
    csvRows.push(`"Total Medicines","${stockSummary[0].total_medicines || 0}"`);
    csvRows.push(`"Total Batches","${stockSummary[0].total_batches || 0}"`);
    csvRows.push(
      `"Total Units in Stock","${stockSummary[0].total_units_in_stock || 0}"`
    );
    csvRows.push(
      `"Total Investment (Cost)","${
        stockSummary[0].total_investment_cost || 0
      }"`
    );
    csvRows.push(
      `"Total Potential Revenue","${
        stockSummary[0].total_potential_revenue || 0
      }"`
    );
    csvRows.push(
      `"Total Potential Profit","${
        stockSummary[0].total_potential_profit || 0
      }"`
    );
    csvRows.push(``);

    // 2. EXPIRY SUMMARY
    csvRows.push(`"=== EXPIRY SUMMARY ==="`);
    csvRows.push(`"Expired Units","${expirySummary[0].expired_units || 0}"`);
    csvRows.push(
      `"Expired Value (Loss)","${expirySummary[0].expired_value || 0}"`
    );
    csvRows.push(
      `"Expiring in 30 Days (Units)","${
        expirySummary[0].expiring_30_units || 0
      }"`
    );
    csvRows.push(
      `"Expiring in 30 Days (Value)","${
        expirySummary[0].expiring_30_value || 0
      }"`
    );
    csvRows.push(``);

    // 3. LOW STOCK ALERTS
    csvRows.push(`"=== LOW STOCK ALERTS ==="`);
    csvRows.push(
      `"Medicine","Unit","Current Stock","Min Level","Order Quantity"`
    );
    if (lowStockItems.length > 0) {
      for (const item of lowStockItems) {
        const name = (item.name || "").replace(/"/g, '""');
        const unit = (item.unit || "").replace(/"/g, '""');
        csvRows.push(
          `"${name}","${unit}","${item.current_stock || 0}","${
            item.min_stock_level || 0
          }","${item.needed_quantity || 0}"`
        );
      }
    } else {
      csvRows.push(`"No low stock items found","","","",""`);
    }
    csvRows.push(``);

    // 4. TOP SELLING MEDICINES
    csvRows.push(`"=== TOP SELLING MEDICINES (This Month) ==="`);
    csvRows.push(`"Medicine","Unit","Quantity Sold","Revenue","Profit"`);
    if (topSelling.length > 0) {
      for (const item of topSelling) {
        const name = (item.name || "").replace(/"/g, '""');
        const unit = (item.unit || "").replace(/"/g, '""');
        csvRows.push(
          `"${name}","${unit}","${item.total_sold || 0}","${
            item.total_revenue || 0
          }","${item.total_profit || 0}"`
        );
      }
    } else {
      csvRows.push(`"No sales data available","","","",""`);
    }
    csvRows.push(``);

    // 5. RECENT EXPIRED BATCHES
    csvRows.push(`"=== RECENT EXPIRED BATCHES ==="`);
    csvRows.push(
      `"Medicine","Batch No","Quantity Lost","Expiry Date","Loss Value"`
    );
    if (recentExpired.length > 0) {
      for (const batch of recentExpired) {
        const name = (batch.medicine_name || "").replace(/"/g, '""');
        const batchNo = (batch.batch_no || "").replace(/"/g, '""');
        const expiryDate = batch.expiry_date
          ? new Date(batch.expiry_date).toLocaleDateString()
          : "";
        csvRows.push(
          `"${name}","${batchNo}","${batch.quantity || 0}","${expiryDate}","${
            batch.loss_value || 0
          }"`
        );
      }
    } else {
      csvRows.push(`"No expired batches found","","","",""`);
    }
    csvRows.push(``);

    // 6. DAILY SALES (Last 30 days)
    csvRows.push(`"=== DAILY SALES (Last 30 Days) ==="`);
    csvRows.push(`"Date","Transactions","Revenue","Profit"`);
    if (weeklySales.length > 0) {
      for (const day of weeklySales) {
        const date = day.date ? new Date(day.date).toLocaleDateString() : "";
        csvRows.push(
          `"${date}","${day.transactions || 0}","${day.revenue || 0}","${
            day.profit || 0
          }"`
        );
      }
    } else {
      csvRows.push(`"No sales data available","","",""`);
    }

    // Join all rows and send
    const csvContent = csvRows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=pharmacy_report_${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
    res.setHeader("Cache-Control", "no-cache");

    return res.status(200).send("\uFEFF" + csvContent);
  } catch (error) {
    console.error("Export error:", error);
    if (!res.headersSent) {
      res.status(500).send("Error exporting report: " + error.message);
    }
  }
};
// Get Dead Stock / Slow Moving Items
exports.getDeadStockReport = async (req, res) => {
  try {
    const daysThreshold = req.query.days || 90; // Default 90 days

    const [deadStock] = await db.query(
      `
      SELECT 
        m.id,
        m.name,
        m.category,
        m.unit,
        COALESCE(SUM(b.quantity), 0) as stock_quantity,
        COALESCE(SUM(b.quantity * b.cost_price), 0) as capital_tied_up,
        COALESCE(MAX(s.created_at), 'Never Sold') as last_sale_date,
        DATEDIFF(NOW(), COALESCE(MAX(s.created_at), '1900-01-01')) as days_since_last_sale
      FROM medicines m
      JOIN batches b ON m.id = b.medicine_id
      LEFT JOIN sale_items si ON b.id = si.batch_id
      LEFT JOIN sales s ON si.sale_id = s.id
      WHERE b.quantity > 0
      GROUP BY m.id
      HAVING last_sale_date = 'Never Sold' OR days_since_last_sale > ?
      ORDER BY capital_tied_up DESC
      LIMIT 50
    `,
      [daysThreshold]
    );

    const [summary] = await db.query(
      `
      SELECT 
        COUNT(*) as total_dead_items,
        COALESCE(SUM(b.quantity * b.cost_price), 0) as total_capital_frozen
      FROM medicines m
      JOIN batches b ON m.id = b.medicine_id
      LEFT JOIN sale_items si ON b.id = si.batch_id
      LEFT JOIN sales s ON si.sale_id = s.id
      WHERE b.quantity > 0
      GROUP BY m.id
      HAVING MAX(s.created_at) IS NULL OR MAX(s.created_at) < DATE_SUB(NOW(), INTERVAL ? DAY)
    `,
      [daysThreshold]
    );

    res.render("reports/deadstock", {
      user: req.session.user,
      deadStock: deadStock,
      summary: summary[0] || { total_dead_items: 0, total_capital_frozen: 0 },
      daysThreshold: daysThreshold,
      error_msg: req.flash("error"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading dead stock report: " + error.message);
  }
};

// Get Peak Hours Analysis
exports.getPeakHoursReport = async (req, res) => {
  try {
    const period = req.query.period || "30"; // Last 30 days default

    const [peakHours] = await db.query(
      `
      SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as transactions,
        SUM(total_amount) as revenue,
        ROUND(AVG(total_amount), 2) as avg_transaction_value
      FROM sales
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC
    `,
      [period]
    );

    // Find peak hour (highest transactions)
    let peakHour = null;
    let maxTransactions = 0;
    for (const hour of peakHours) {
      if (hour.transactions > maxTransactions) {
        maxTransactions = hour.transactions;
        peakHour = hour;
      }
    }

    res.render("reports/peakhours", {
      user: req.session.user,
      peakHours: peakHours,
      peakHour: peakHour,
      period: period,
      error_msg: req.flash("error"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading peak hours report: " + error.message);
  }
};

// Get Payment Method Breakdown
exports.getPaymentMethodReport = async (req, res) => {
  try {
    const period = req.query.period || "30"; // Last 30 days default

    const [paymentBreakdown] = await db.query(
      `
      SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_amount,
        ROUND(AVG(total_amount), 2) as avg_amount,
        ROUND((SUM(total_amount) / (SELECT SUM(total_amount) FROM sales WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY) AND status = 'completed') * 100), 2) as percentage
      FROM sales
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `,
      [period, period]
    );

    const [todayBreakdown] = await db.query(`
      SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_amount
      FROM sales
      WHERE DATE(created_at) = CURDATE()
        AND status = 'completed'
      GROUP BY payment_method
    `);

    res.render("reports/paymentmethods", {
      user: req.session.user,
      paymentBreakdown: paymentBreakdown,
      todayBreakdown: todayBreakdown,
      period: period,
      error_msg: req.flash("error"),
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send("Error loading payment methods report: " + error.message);
  }
};
