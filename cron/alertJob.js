// cron/alertJob.js
import { getConnection, sql } from "../db.js";

export const runAlertCheck = async () => {
  console.log("🔁 Running Alert Check...");

  try {
    const pool = await getConnection();

    // 1. Get latest row of sensor data
    const latestSensorRes = await pool.request().query(`
      SELECT TOP 1 * FROM cbm_sensor_data ORDER BY timestamp DESC
    `);

    const latestRow = latestSensorRes.recordset[0];
    if (!latestRow) {
      console.warn("⚠️ No sensor data found.");
      return;
    }

    // 2. Get thresholds
    const thresholdRes = await pool.request().query(`
      SELECT plant, machine, tag_name, min_value, max_value
      FROM cbm_tag_thresholds
    `);

    const alerts = [];

    for (const threshold of thresholdRes.recordset) {
      const { tag_name, plant, machine, min_value, max_value } = threshold;
      const value = latestRow[tag_name];

      if (value == null) continue;

      if (value < min_value || value > max_value) {
        alerts.push({
          plant,
          machine,
          tag_name,
          value,
          status: "Alert",
          timestamp: latestRow.timestamp,
        });
      }
    }

    // 3. Insert new alerts (if any)
    if (alerts.length > 0) {
      const table = new sql.Table("cbm_alerts");
      table.create = false;
      table.columns.add("plant", sql.VarChar(50));
      table.columns.add("machine", sql.VarChar(100));
      table.columns.add("tag_name", sql.VarChar(100));
      table.columns.add("value", sql.Float);
      table.columns.add("status", sql.VarChar(20));
      table.columns.add("timestamp", sql.DateTime);

      alerts.forEach((a) => {
        table.rows.add(
          a.plant,
          a.machine,
          a.tag_name,
          a.value,
          a.status,
          a.timestamp
        );
      });

      await pool.request().bulk(table);
      console.log(`⚠️ Inserted ${alerts.length} alerts.`);
    } else {
      console.log("✅ No alerts triggered.");
    }
  } catch (err) {
    console.error("❌ Alert Job Error:", err);
  }
};
