const db = require("../config/db");
const { sendEmail } = require("../config/email");

// Get owner email(s)
const getOwnerEmails = async () => {
  const [owners] = await db.query(
    "SELECT email, name FROM users WHERE role = 'owner' AND status = 'active'"
  );
  return owners;
};

// Check for expiring batches and send alerts (ONE EMAIL with ALL TIERS)
const checkExpiryAlerts = async () => {
  try {
    console.log("Checking expiry alerts...", new Date().toLocaleString());

    // Define expiry tiers (days before expiry)
    const tiers = [
      { days: 90, label: "90 Days", color: "#17a2b8", urgency: "ℹ️ PLANNING" },
      { days: 60, label: "60 Days", color: "#6f42c1", urgency: "ℹ️ PLANNING" },
      { days: 30, label: "30 Days", color: "#ffc107", urgency: "⚠️ WARNING" },
      { days: 15, label: "15 Days", color: "#fd7e14", urgency: "⚠️ WARNING" },
      { days: 7, label: "7 Days", color: "#fd7e14", urgency: "⚠️ HIGH" },
      { days: 3, label: "3 Days", color: "#dc3545", urgency: "🚨 CRITICAL" },
      { days: 1, label: "Tomorrow", color: "#dc3545", urgency: "🚨 CRITICAL" },
    ];

    // Get ALL expiring batches (not yet notified)
    const [allExpiringBatches] = await db.query(`
      SELECT 
        b.id,
        b.batch_no,
        b.quantity,
        b.expiry_date,
        b.cost_price,
        b.selling_price,
        b.expiry_notified,
        m.name as medicine_name,
        m.unit,
        s.name as supplier_name,
        DATEDIFF(b.expiry_date, CURDATE()) as days_remaining
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.expiry_date > CURDATE()
        AND b.quantity > 0
        AND b.expiry_notified = FALSE
      ORDER BY b.expiry_date ASC
    `);

    // Get already expired batches
    const [expiredBatches] = await db.query(`
      SELECT 
        b.id,
        b.batch_no,
        b.quantity,
        b.expiry_date,
        b.cost_price,
        m.name as medicine_name,
        m.unit,
        (b.quantity * b.cost_price) as total_loss
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      WHERE b.expiry_date < CURDATE() 
        AND b.quantity > 0
        AND b.expiry_notified = FALSE
      ORDER BY b.expiry_date DESC
    `);

    if (allExpiringBatches.length === 0 && expiredBatches.length === 0) {
      console.log("No expiry alerts to send");
      return;
    }

    // Group batches by tier
    let tieredBatches = {};
    for (const tier of tiers) {
      tieredBatches[tier.days] = {
        batches: [],
        label: tier.label,
        color: tier.color,
        urgency: tier.urgency,
      };
    }

    const batchesToUpdate = [];

    for (const batch of allExpiringBatches) {
      const daysRemaining = batch.days_remaining;

      // Find the appropriate tier for this batch (closest match)
      let assignedTier = null;
      for (const tier of tiers) {
        if (daysRemaining <= tier.days) {
          assignedTier = tier.days;
          break;
        }
      }

      if (assignedTier && tieredBatches[assignedTier]) {
        tieredBatches[assignedTier].batches.push(batch);
        batchesToUpdate.push(batch.id);
      }
    }

    // Get owner emails
    const owners = await getOwnerEmails();
    if (owners.length === 0) {
      console.log("No owner email found");
      return;
    }

    // Build email content for all tiers in ONE email
    let allExpiringHtml = "";
    let totalValueAtRisk = 0;

    // Display tiers from most urgent to least urgent
    const tiersReversed = [...tiers].reverse();

    for (const tier of tiersReversed) {
      const batches = tieredBatches[tier.days].batches;
      if (batches.length === 0) continue;

      let tierValueAtRisk = 0;
      let tierHtml = `
        <div style="margin-bottom: 25px; border: 1px solid ${tier.color}; border-radius: 8px; overflow: hidden;">
          <div style="background: ${tier.color}; color: white; padding: 10px 15px;">
            <h4 style="margin: 0;">${tier.urgency} - ${tier.label} Before Expiry</h4>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="border: 1px solid #ddd; padding: 8px;">Medicine</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Batch No</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Quantity</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Supplier</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Expiry Date</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Days Left</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Value at Risk</th>
              </tr>
            </thead>
            <tbody>
      `;

      for (const batch of batches) {
        const valueAtRisk = batch.quantity * batch.cost_price;
        tierValueAtRisk += valueAtRisk;
        totalValueAtRisk += valueAtRisk;

        tierHtml += `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${
              batch.medicine_name
            } (${batch.unit})</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${
              batch.batch_no
            }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${
              batch.quantity
            }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${
              batch.supplier_name || "No supplier"
            }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${new Date(
              batch.expiry_date
            ).toLocaleDateString()}</td>
            <td style="border: 1px solid #ddd; padding: 8px; color: ${
              tier.color
            }; font-weight: bold;">${batch.days_remaining} days</td>
            <td style="border: 1px solid #ddd; padding: 8px;">₹${valueAtRisk.toLocaleString()}</td>
          </tr>
        `;
      }

      tierHtml += `
            </tbody>
          </table>
          <div style="background: #f8f9fa; padding: 10px 15px; text-align: right;">
            <strong>Total value at risk for this tier: ₹${tierValueAtRisk.toLocaleString()}</strong>
          </div>
        </div>
      `;

      allExpiringHtml += tierHtml;
    }

    // Update expiry_notified for batches we've notified (only ONCE per batch)
    if (batchesToUpdate.length > 0) {
      const placeholders = batchesToUpdate.map(() => "?").join(",");
      await db.query(
        `UPDATE batches SET expiry_notified = TRUE WHERE id IN (${placeholders})`,
        batchesToUpdate
      );
    }

    // Build expired batches HTML
    let expiredHtml = "";
    let totalLoss = 0;

    if (expiredBatches.length > 0) {
      expiredHtml = `
        <div style="margin-bottom: 25px; border: 1px solid #dc3545; border-radius: 8px; overflow: hidden;">
          <div style="background: #dc3545; color: white; padding: 10px 15px;">
            <h4 style="margin: 0;">❌ EXPIRED BATCHES - FINANCIAL LOSS ❌</h4>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="border: 1px solid #ddd; padding: 8px;">Medicine</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Batch No</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Quantity Lost</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Expiry Date</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Financial Loss</th>
              </tr>
            </thead>
            <tbody>
      `;

      for (const batch of expiredBatches) {
        totalLoss += batch.total_loss;
        expiredHtml += `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${
              batch.medicine_name
            } (${batch.unit})</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${
              batch.batch_no
            }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${
              batch.quantity
            }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${new Date(
              batch.expiry_date
            ).toLocaleDateString()}</td>
            <td style="border: 1px solid #ddd; padding: 8px; color: #dc3545; font-weight: bold;">₹${batch.total_loss.toLocaleString()}</td>
          </tr>
        `;

        // Mark expired batches as notified
        await db.query(
          "UPDATE batches SET expiry_notified = TRUE WHERE id = ?",
          [batch.id]
        );
      }

      expiredHtml += `
            </tbody>
          </table>
          <div style="background: #f8f9fa; padding: 10px 15px; text-align: right;">
            <strong>Total Financial Loss: ₹${totalLoss.toLocaleString()}</strong>
          </div>
        </div>
      `;
    }

    // Send ONE email to each owner with ALL tiers combined
    for (const owner of owners) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 900px; margin: auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; text-align: center; border-radius: 10px; }
            .content { padding: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .summary-box { background: #e8f4f8; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🏥 Pharmacy System Alert</h2>
              <p>Expiry Notification - ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="content">
              <p>Dear ${owner.name},</p>
              <p>This is an automated alert from your Pharmacy Management System.</p>
              
              <div class="summary-box">
                <strong>📊 Today's Summary:</strong><br>
                • Total value at risk from expiring batches: ₹${totalValueAtRisk.toLocaleString()}<br>
                • Total financial loss from expired batches: ₹${totalLoss.toLocaleString()}
              </div>
              
              ${allExpiringHtml}
              ${expiredHtml}
              
              <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px;">
                <strong>⚠️ Action Items by Urgency:</strong>
                <ul>
                  <li><strong style="color: #dc3545;">🚨 CRITICAL (1-3 days):</strong> Immediate action - discount or return to supplier</li>
                  <li><strong style="color: #fd7e14;">⚠️ HIGH (7 days):</strong> Run promotions, move to front shelves</li>
                  <li><strong style="color: #ffc107;">⚠️ WARNING (15-30 days):</strong> Plan discount strategy</li>
                  <li><strong style="color: #17a2b8;">ℹ️ PLANNING (60-90 days):</strong> Start planning returns or promotions</li>
                </ul>
              </div>
              
              <hr>
              <p style="margin-top: 20px;">
                <strong>Quick Links:</strong><br>
                <a href="${
                  process.env.APP_URL || "http://localhost:3000"
                }/batches?status=expiring">View Expiring Batches</a><br>
                <a href="${
                  process.env.APP_URL || "http://localhost:3000"
                }/reports">View Full Report</a>
              </p>
            </div>
            <div class="footer">
              <p>This is an automated notification from your Pharmacy Management System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail(
        owner.email,
        `[Pharmacy Alert] ${
          batchesToUpdate.length + expiredBatches.length
        } Batch(es) Require Attention - ${new Date().toLocaleDateString()}`,
        emailHtml
      );
    }

    console.log(
      `Expiry alerts sent: ${batchesToUpdate.length} expiring batches, ${expiredBatches.length} expired batches`
    );
  } catch (error) {
    console.error("Error in expiry alert check:", error);
  }
};

// Check for low stock alerts
const checkLowStockAlerts = async () => {
  try {
    console.log("Checking low stock alerts...", new Date().toLocaleString());

    // Get low stock items
    const [lowStockItems] = await db.query(`
      SELECT 
        m.id,
        m.name,
        m.unit,
        m.min_stock_level,
        COALESCE(SUM(b.quantity), 0) as current_stock,
        (m.min_stock_level - COALESCE(SUM(b.quantity), 0)) as needed_quantity
      FROM medicines m
      LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0
      GROUP BY m.id
      HAVING current_stock <= min_stock_level AND current_stock > 0
      ORDER BY current_stock ASC
    `);

    // Get out of stock items
    const [outOfStockItems] = await db.query(`
      SELECT 
        m.id,
        m.name,
        m.unit,
        m.min_stock_level,
        COALESCE(SUM(b.quantity), 0) as current_stock
      FROM medicines m
      LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0
      GROUP BY m.id
      HAVING COALESCE(SUM(b.quantity), 0) = 0
      ORDER BY m.name
    `);

    if (lowStockItems.length === 0 && outOfStockItems.length === 0) {
      console.log("No low stock alerts to send");
      return;
    }

    // Get owner emails
    const owners = await getOwnerEmails();
    if (owners.length === 0) {
      console.log("No owner email found");
      return;
    }

    // Build email content
    let lowStockHtml = "";
    let outOfStockHtml = "";

    if (lowStockItems.length > 0) {
      lowStockHtml = `
        <h3 style="color: #fd7e14;">⚠️ Low Stock Alert</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background: #fd7e14; color: white;">Medicine</th>
              <th style="border: 1px solid #ddd; padding: 8px; background: #fd7e14; color: white;">Current Stock</th>
              <th style="border: 1px solid #ddd; padding: 8px; background: #fd7e14; color: white;">Min Stock Level</th>
              <th style="border: 1px solid #ddd; padding: 8px; background: #fd7e14; color: white;">Order Quantity</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (const item of lowStockItems) {
        lowStockHtml += `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.name} (${item.unit})</td>
            <td style="border: 1px solid #ddd; padding: 8px; color: #fd7e14; font-weight: bold;">${item.current_stock}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.min_stock_level}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.needed_quantity}</td>
          </tr>
        `;
      }

      lowStockHtml += `</tbody> </table>`;
    }

    if (outOfStockItems.length > 0) {
      outOfStockHtml = `
        <h3 style="color: #dc3545;">❌ Out of Stock Alert - URGENT!</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background: #dc3545; color: white;">Medicine</th>
              <th style="border: 1px solid #ddd; padding: 8px; background: #dc3545; color: white;">Unit</th>
              <th style="border: 1px solid #ddd; padding: 8px; background: #dc3545; color: white;">Current Stock</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (const item of outOfStockItems) {
        outOfStockHtml += `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.unit}</td>
            <td style="border: 1px solid #ddd; padding: 8px; color: #dc3545; font-weight: bold;">0</td>
          </tr>
        `;
      }

      outOfStockHtml += `</tbody> </table>`;
    }

    // Send email to each owner
    for (const owner of owners) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 800px; margin: auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; text-align: center; border-radius: 10px; }
            .content { padding: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🏥 Pharmacy System Alert</h2>
              <p>Stock Alert - ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="content">
              <p>Dear ${owner.name},</p>
              <p>This is an automated stock alert from your Pharmacy Management System.</p>
              
              ${lowStockHtml}
              ${outOfStockHtml}
              
              <div style="background: ${
                outOfStockItems.length > 0 ? "#f8d7da" : "#fff3cd"
              }; padding: 15px; border-radius: 5px; margin-top: 20px;">
                <strong>⚠️ Action Required:</strong> Please review the following:
                <ul>
                  ${
                    lowStockItems.length > 0
                      ? "<li>Place orders for low stock items before they run out</li>"
                      : ""
                  }
                  ${
                    outOfStockItems.length > 0
                      ? "<li>IMMEDIATE ACTION: Restock out-of-stock items</li>"
                      : ""
                  }
                </ul>
              </div>
              
              <hr>
              <p style="margin-top: 20px;">
                <strong>Quick Links:</strong><br>
                <a href="${
                  process.env.APP_URL || "http://localhost:3000"
                }/medicines">Restock Medicines</a><br>
                <a href="${
                  process.env.APP_URL || "http://localhost:3000"
                }/batches/create">Add New Stock</a>
              </p>
            </div>
            <div class="footer">
              <p>This is an automated notification from your Pharmacy Management System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail(
        owner.email,
        `[Pharmacy Alert] ${
          lowStockItems.length + outOfStockItems.length
        } Stock Item(s) Need Attention`,
        emailHtml
      );
    }

    console.log(
      `Stock alerts sent: ${lowStockItems.length} low stock, ${outOfStockItems.length} out of stock`
    );
  } catch (error) {
    console.error("Error in low stock alert check:", error);
  }
};

// Weekly summary report (unchanged)
const sendWeeklySummary = async () => {
  try {
    console.log("Sending weekly summary...", new Date().toLocaleString());

    const [weeklySales] = await db.query(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(total_profit), 0) as total_profit,
        COALESCE(SUM(total_amount) / NULLIF(COUNT(*), 0), 0) as avg_sale
      FROM sales
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);

    const [topProducts] = await db.query(`
      SELECT 
        m.name,
        SUM(si.quantity) as quantity_sold,
        SUM(si.profit) as profit
      FROM sale_items si
      JOIN batches b ON si.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY b.medicine_id, m.name
      ORDER BY quantity_sold DESC
      LIMIT 5
    `);

    const owners = await getOwnerEmails();
    if (owners.length === 0) return;

    for (const owner of owners) {
      let topProductsHtml = "";
      if (topProducts.length > 0) {
        topProductsHtml = `
          <h3>🏆 Top Selling Products This Week</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr><th>Product</th><th>Quantity</th><th>Profit</th></tr>
            </thead>
            <tbody>
        `;

        for (const p of topProducts) {
          topProductsHtml += `
            <tr>
              <td>${p.name}</td>
              <td>${p.quantity_sold}</td>
              <td>₹${parseFloat(p.profit).toLocaleString()}</td>
            </tr>
          `;
        }

        topProductsHtml += `</tbody> </table>`;
      }

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 800px; margin: auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; text-align: center; border-radius: 10px; }
            .content { padding: 20px; }
            .stats { display: flex; justify-content: space-around; margin: 20px 0; flex-wrap: wrap; gap: 10px; }
            .stat-box { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; flex: 1; min-width: 120px; }
            .stat-number { font-size: 24px; font-weight: bold; color: #28a745; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📊 Weekly Pharmacy Summary</h2>
              <p>${new Date().toLocaleDateString()}</p>
            </div>
            <div class="content">
              <p>Dear ${owner.name},</p>
              <p>Here is your weekly pharmacy performance summary.</p>
              
              <div class="stats">
                <div class="stat-box">
                  <div class="stat-number">${
                    weeklySales[0].total_sales || 0
                  }</div>
                  <div>Total Sales</div>
                </div>
                <div class="stat-box">
                  <div class="stat-number">₹${(
                    weeklySales[0].total_revenue || 0
                  ).toLocaleString()}</div>
                  <div>Revenue</div>
                </div>
                <div class="stat-box">
                  <div class="stat-number">₹${(
                    weeklySales[0].total_profit || 0
                  ).toLocaleString()}</div>
                  <div>Profit</div>
                </div>
                <div class="stat-box">
                  <div class="stat-number">₹${(
                    weeklySales[0].avg_sale || 0
                  ).toLocaleString()}</div>
                  <div>Avg Sale</div>
                </div>
              </div>
              
              ${topProductsHtml}
              
              <hr>
              <p><a href="${
                process.env.APP_URL || "http://localhost:3000"
              }/reports">View Full Report →</a></p>
            </div>
            <div class="footer">
              <p>Weekly summary from your Pharmacy Management System</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail(
        owner.email,
        "[Pharmacy] Weekly Performance Summary",
        emailHtml
      );
    }

    console.log("Weekly summary sent");
  } catch (error) {
    console.error("Error sending weekly summary:", error);
  }
};

module.exports = {
  checkExpiryAlerts,
  checkLowStockAlerts,
  sendWeeklySummary,
};
