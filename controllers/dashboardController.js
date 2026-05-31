const db = require("../config/db");

// MAIN DASHBOARD - Complete System Overview
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

    // ========== 6. SALES SUMMARY (Today & This Month) ==========
    const [todaySales] = await db.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(total_profit), 0) as profit,
        COUNT(*) as transactions,
        COALESCE(COUNT(*) / NULLIF(SUM(total_amount), 0), 0) as avg_transaction
      FROM sales
      WHERE DATE(created_at) = CURDATE()
    `);

    const [monthSales] = await db.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(total_profit), 0) as profit,
        COUNT(*) as transactions
      FROM sales
      WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
    `);

    // ========== 7. WEEKLY SALES TREND (Last 7 days) ==========
    const [weeklyTrend] = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(total_profit), 0) as profit,
        COUNT(*) as transactions
      FROM sales
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // ========== 8. TOP SELLING MEDICINES (This Month) ==========
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
      GROUP BY b.medicine_id
      ORDER BY total_sold DESC
      LIMIT 5
    `);

    // ========== 9. SUPPLIER SUMMARY ==========
    const [supplierSummary] = await db.query(`
      SELECT 
        COUNT(*) as total_suppliers,
        COUNT(DISTINCT b.id) as batches_received,
        COALESCE(SUM(b.quantity * b.cost_price), 0) as total_purchased
      FROM suppliers s
      LEFT JOIN batches b ON s.id = b.supplier_id
    `);

    // ========== 10. MANUFACTURER SUMMARY ==========
    const [manufacturerSummary] = await db.query(`
      SELECT 
        COUNT(*) as total_manufacturers,
        COUNT(DISTINCT m.id) as medicines_count
      FROM manufacturers mf
      LEFT JOIN medicines m ON mf.id = m.manufacturer_id
    `);

    // ========== 11. PROFIT MARGIN ANALYSIS ==========
    const [marginAnalysis] = await db.query(`
      SELECT 
        AVG((selling_price - cost_price) / selling_price * 100) as avg_margin_percent,
        MIN((selling_price - cost_price) / selling_price * 100) as min_margin,
        MAX((selling_price - cost_price) / selling_price * 100) as max_margin
      FROM batches
      WHERE selling_price > 0 AND quantity > 0
    `);

    // ========== 12. RECENT ACTIVITIES ==========
    const [recentSales] = await db.query(`
      SELECT 
        'sale' as type,
        s.id as reference_id,
        s.created_at as date,
        u.name as user_name,
        CONCAT('Sale #', s.id, ' - ₹', s.total_amount) as description
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
        u.name as user_name,
        CONCAT('Stock added: ', b.batch_no, ' - ', m.name, ' (', b.quantity, ' ', m.unit, ')') as description
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      LEFT JOIN users u ON b.created_by = u.id
      ORDER BY b.created_at DESC
      LIMIT 5
    `);

    // Combine recent activities
    let recentActivities = [...recentSales, ...recentBatches];
    recentActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
    recentActivities = recentActivities.slice(0, 10);

    res.render("dashboard/index", {
      // Stock Summary
      totalMedicines: stockSummary[0].total_medicines || 0,
      totalBatches: stockSummary[0].total_batches || 0,
      totalUnits: stockSummary[0].total_units_in_stock || 0,
      totalInvestment: stockSummary[0].total_investment_cost || 0,
      totalPotentialRevenue: stockSummary[0].total_potential_revenue || 0,
      totalPotentialProfit: stockSummary[0].total_potential_profit || 0,

      // Expiry Summary
      expiredUnits: expirySummary[0].expired_units || 0,
      expiredValue: expirySummary[0].expired_value || 0,
      expiring30Units: expirySummary[0].expiring_30_units || 0,
      expiring30Value: expirySummary[0].expiring_30_value || 0,
      expiring90Units: expirySummary[0].expiring_90_units || 0,
      expiring90Value: expirySummary[0].expiring_90_value || 0,
      expiredBatches: expirySummary[0].expired_batches || 0,
      expiring30Batches: expirySummary[0].expiring_30_batches || 0,

      // Alerts
      lowStockItems: lowStockItems,
      outOfStockItems: outOfStockItems,
      recentExpired: recentExpired,

      // Sales Summary
      todayRevenue: todaySales[0].revenue || 0,
      todayProfit: todaySales[0].profit || 0,
      todayTransactions: todaySales[0].transactions || 0,
      monthRevenue: monthSales[0].revenue || 0,
      monthProfit: monthSales[0].profit || 0,
      monthTransactions: monthSales[0].transactions || 0,

      // Trends
      weeklyTrend: weeklyTrend,
      topSelling: topSelling,

      // Suppliers & Manufacturers
      totalSuppliers: supplierSummary[0].total_suppliers || 0,
      totalPurchased: supplierSummary[0].total_purchased || 0,
      totalManufacturers: manufacturerSummary[0].total_manufacturers || 0,

      // Margin Analysis
      avgMargin: marginAnalysis[0].avg_margin_percent || 0,

      // Recent Activities
      recentActivities: recentActivities,

      // User info
      user: req.session.user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading dashboard: " + error.message);
  }
};
