// Updated alertJob.js with severity logic and duplicate prevention
import { getConnection, sql } from "../db.js";

export const runAlertCheck = async () => {
  try {
    console.log("🔁 Running Alert Check...");

    const pool = await getConnection();

    // Step 1: Get latest sensor row
    const latestSensorResult = await pool.request().query(`
      SELECT TOP 1 * FROM cbm_sensor_data ORDER BY timestamp DESC
    `);
    const latestSensor = latestSensorResult.recordset[0];
    if (!latestSensor) return console.log("❌ No sensor data available.");

    // Step 2: Get all tag thresholds
    const thresholdsResult = await pool.request().query(`
      SELECT * FROM cbm_tag_thresholds
    `);
    const thresholds = thresholdsResult.recordset;

    // Step 3: For each threshold config, compare against sensor value
    const alertsToInsert = [];

    for (const threshold of thresholds) {
      const {
        plant, machine, tag_name, min_value, max_value, mailRecipients
      } = threshold;

      const currentValue = latestSensor[tag_name]; // Match column name
      if (currentValue == null) continue;

      let severity = null;
      if (currentValue < min_value * 0.9 || currentValue > max_value * 1.1) {
        severity = "Critical";
      } else if (currentValue < min_value || currentValue > max_value) {
        severity = "Warning";
      }

      if (!severity) continue;

      // Step 4: Check if duplicate alert (same tag and severity) exists in last 10 min
      const duplicateCheck = await pool.request()
        .input("plant", sql.VarChar, plant)
        .input("machine", sql.VarChar, machine)
        .input("tag_name", sql.VarChar, tag_name)
        .input("severity", sql.VarChar, severity)
        .query(`
          SELECT COUNT(*) AS count
          FROM cbm_alerts
          WHERE plant = @plant AND machine = @machine AND tag_name = @tag_name
            AND severity = @severity AND time_triggered >= DATEADD(MINUTE, -10, GETDATE())
        `);

      const alreadyExists = duplicateCheck.recordset[0].count > 0;
      if (!alreadyExists) {
        alertsToInsert.push({
          plant,
          machine,
          tag_name,
          value: currentValue,
          time_triggered: new Date(),
          resolved_flag: 0,
          severity,
          mail_recipients: mailRecipients || null,
        });
      }
    }

    // Step 5: Insert alerts
    for (const alert of alertsToInsert) {
      await pool.request()
        .input("plant", sql.VarChar, alert.plant)
        .input("machine", sql.VarChar, alert.machine)
        .input("tag_name", sql.VarChar, alert.tag_name)
        .input("value", sql.Float, alert.value)
        .input("time_triggered", sql.DateTime, alert.time_triggered)
        .input("resolved_flag", sql.Int, alert.resolved_flag)
        .input("severity", sql.VarChar, alert.severity)
        .input("mail_recipients", sql.VarChar, alert.mail_recipients)
        .query(`
          INSERT INTO cbm_alerts (plant, machine, tag_name, value, time_triggered, resolved_flag, severity, mail_recipients)
          VALUES (@plant, @machine, @tag_name, @value, @time_triggered, @resolved_flag, @severity, @mail_recipients)
        `);
    }

    console.log(`⚠️ Inserted ${alertsToInsert.length} alerts`);
  } catch (err) {
    console.error("❌ Alert Job Error:", err);
  }
};
