const db = require("../config/db");

// SHOW SALES REPORT PAGE
exports.index = async (req, res) => {
  try {
    const period = req.query.period || "today";
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;

    let dateCondition = "";
    let params = [];
    let dateRangeText = "";

    // Set date condition based on period
    switch (period) {
      case "today":
        dateCondition = "DATE(s.created_at) = CURDATE()";
        dateRangeText = "Today's Sales";
        break;
      case "yesterday":
        dateCondition =
          "DATE(s.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
        dateRangeText = "Yesterday's Sales";
        break;
      case "week":
        dateCondition = "YEARWEEK(s.created_at) = YEARWEEK(CURDATE())";
        dateRangeText = "This Week's Sales";
        break;
      case "last_week":
        dateCondition =
          "YEARWEEK(s.created_at) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 1 WEEK))";
        dateRangeText = "Last Week's Sales";
        break;
      case "month":
        dateCondition =
          "MONTH(s.created_at) = MONTH(CURDATE()) AND YEAR(s.created_at) = YEAR(CURDATE())";
        dateRangeText = "This Month's Sales";
        break;
      case "last_month":
        dateCondition =
          "MONTH(s.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(s.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))";
        dateRangeText = "Last Month's Sales";
        break;
      case "year":
        dateCondition = "YEAR(s.created_at) = YEAR(CURDATE())";
        dateRangeText = "This Year's Sales";
        break;
      case "last_year":
        dateCondition =
          "YEAR(s.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 YEAR))";
        dateRangeText = "Last Year's Sales";
        break;
      case "custom":
        if (startDate && endDate) {
          dateCondition = "DATE(s.created_at) BETWEEN ? AND ?";
          params = [startDate, endDate];
          dateRangeText = `Sales from ${new Date(
            startDate
          ).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`;
        } else {
          dateCondition = "DATE(s.created_at) = CURDATE()";
          dateRangeText = "Today's Sales";
        }
        break;
      default:
        dateCondition = "DATE(s.created_at) = CURDATE()";
        dateRangeText = "Today's Sales";
    }

    // Get sales with items
    let query = `
      SELECT 
        s.id,
        s.created_at as sale_date,
        s.total_amount,
        s.total_profit,
        u.name as seller_name,
        COUNT(DISTINCT si.id) as item_count,
        GROUP_CONCAT(
          CONCAT(
            si.quantity, ' x ', m.name, ' (', b.batch_no, ')'
          ) SEPARATOR ' | '
        ) as item_details
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN batches b ON si.batch_id = b.id
      LEFT JOIN medicines m ON b.medicine_id = m.id
      WHERE ${dateCondition}
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    const [sales] = await db.query(query, params);

    // Get summary statistics
    let summaryQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as total_transactions,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(s.total_profit), 0) as total_profit,
        COALESCE(SUM(s.total_amount) / NULLIF(COUNT(DISTINCT s.id), 0), 0) as avg_transaction_value,
        COUNT(DISTINCT u.id) as active_sellers,
        COALESCE(SUM(si.quantity), 0) as total_items_sold,
        COALESCE(SUM(s.total_amount) - SUM(s.total_profit), 0) as total_cost
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE ${dateCondition}
    `;

    const [summary] = await db.query(summaryQuery, params);

    // Get top selling medicines
    let topProductsQuery = `
      SELECT 
        m.name,
        m.unit,
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.subtotal) as total_revenue,
        SUM(si.profit) as total_profit,
        AVG(si.selling_price) as avg_price
      FROM sale_items si
      JOIN batches b ON si.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      JOIN sales s ON si.sale_id = s.id
      WHERE ${dateCondition}
      GROUP BY b.medicine_id, m.name, m.unit
      ORDER BY total_quantity_sold DESC
      LIMIT 10
    `;

    const [topProducts] = await db.query(topProductsQuery, params);

    // Get sales by seller (user)
    let sellerPerformanceQuery = `
      SELECT 
        u.name as seller_name,
        COUNT(DISTINCT s.id) as transactions,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(s.total_profit), 0) as total_profit,
        COALESCE(SUM(s.total_amount) / NULLIF(COUNT(DISTINCT s.id), 0), 0) as avg_sale
      FROM sales s
      JOIN users u ON s.user_id = u.id
      WHERE ${dateCondition}
      GROUP BY u.id
      ORDER BY total_revenue DESC
    `;

    const [sellerPerformance] = await db.query(sellerPerformanceQuery, params);

    res.render("sales/index", {
      sales: sales,
      summary: summary[0],
      topProducts: topProducts,
      sellerPerformance: sellerPerformance,
      period: period,
      startDate: startDate,
      endDate: endDate,
      dateRangeText: dateRangeText,
      success_msg: req.flash("success"),
      error_msg: req.flash("error"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching sales reports: " + error.message);
  }
};

// GET SALES DETAILS FOR A SPECIFIC SALE
exports.getSaleDetails = async (req, res) => {
  const { id } = req.params;

  try {
    // Get sale header
    const [sales] = await db.query(
      `
      SELECT s.*, u.name as seller_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `,
      [id]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: "Sale not found" });
    }

    // Get sale items with medicine and batch info
    const [items] = await db.query(
      `
      SELECT 
        si.*,
        m.name as medicine_name,
        m.unit,
        b.batch_no,
        b.expiry_date
      FROM sale_items si
      JOIN batches b ON si.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      WHERE si.sale_id = ?
    `,
      [id]
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

// EXPORT SALES REPORT (CSV)
exports.exportReport = async (req, res) => {
  try {
    const period = req.query.period || "today";
    let dateCondition = "";
    let params = [];

    switch (period) {
      case "today":
        dateCondition = "DATE(s.created_at) = CURDATE()";
        break;
      case "week":
        dateCondition = "YEARWEEK(s.created_at) = YEARWEEK(CURDATE())";
        break;
      case "month":
        dateCondition =
          "MONTH(s.created_at) = MONTH(CURDATE()) AND YEAR(s.created_at) = YEAR(CURDATE())";
        break;
      case "year":
        dateCondition = "YEAR(s.created_at) = YEAR(CURDATE())";
        break;
      default:
        dateCondition = "DATE(s.created_at) = CURDATE()";
    }

    const [sales] = await db.query(
      `
      SELECT 
        s.id as invoice_no,
        s.created_at as date,
        u.name as seller,
        s.total_amount as total,
        s.total_profit as profit,
        GROUP_CONCAT(CONCAT(si.quantity, 'x', m.name) SEPARATOR ', ') as items
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN batches b ON si.batch_id = b.id
      LEFT JOIN medicines m ON b.medicine_id = m.id
      WHERE ${dateCondition}
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `,
      params
    );

    // Create CSV
    let csv = "Invoice No,Date,Seller,Items,Total Amount,Profit\n";
    sales.forEach((sale) => {
      csv += `"${sale.invoice_no}","${new Date(sale.date).toLocaleString()}","${
        sale.seller
      }","${sale.items || ""}","${sale.total}","${sale.profit}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales_report_${period}_${Date.now()}.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error exporting report");
  }
};

// GET DAILY SALES CHART DATA (for future charts)
exports.getDailySalesData = async (req, res) => {
  try {
    const days = req.query.days || 7;
    const [data] = await db.query(
      `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_amount,
        SUM(total_profit) as total_profit
      FROM sales
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
      [days]
    );

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching daily sales data" });
  }
};
