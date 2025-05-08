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

    thresholds.forEach(threshold => {
      const {
        plant, machine, tag_name, min_value, max_value
      } = threshold;

      const currentValue = latestSensor[tag_name]; // Match column name

      if (currentValue == null) return; // Skip if sensor tag is null

      if (currentValue < min_value || currentValue > max_value) {
        alertsToInsert.push({
          plant,
          machine,
          tag_name,
          value: currentValue,
          time_triggered: new Date(),
          resolved_flag: 0
        });
      }
    });

    // Step 4: Insert alerts
    for (const alert of alertsToInsert) {
      await pool.request()
        .input("plant", sql.VarChar, alert.plant)
        .input("machine", sql.VarChar, alert.machine)
        .input("tag_name", sql.VarChar, alert.tag_name)
        .input("value", sql.Float, alert.value)
        .input("time_triggered", sql.DateTime, alert.time_triggered)
        .input("resolved_flag", sql.Int, alert.resolved_flag)
        .query(`
          INSERT INTO cbm_alerts (plant, machine, tag_name, value, time_triggered, resolved_flag)
          VALUES (@plant, @machine, @tag_name, @value, @time_triggered, @resolved_flag)
        `);
    }

    console.log(`⚠️ Inserted ${alertsToInsert.length} alerts`);

  } catch (err) {
    console.error("❌ Alert Job Error:", err);
  }
};
