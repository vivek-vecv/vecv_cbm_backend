// controllers/dashboardController.js
import { getConnection, sql } from "../db.js";

// ✅ Get overall machine health summary by plant (used in PlantCards.jsx)
export const getStatusSummary = async (req, res) => {
  try {
    const pool = await getConnection();

    const thresholdRes = await pool.request().query(`
      SELECT plant, machine, tag_name, line
      FROM cbm_tag_thresholds
    `);

    const tagMap = {};
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    thresholdRes.recordset.forEach(({ plant, machine, tag_name, line }) => {
      const key = `${plant}|${machine}`;
      if (!tagMap[key]) tagMap[key] = { plant, machine, line, tags: [] };
      tagMap[key].tags.push(tag_name);
    });

    const sensorRes = await pool.request().query(`
      SELECT * FROM cbm_sensor_data
      WHERE timestamp >= '${oneHourAgo.toISOString()}'
    `);

    const activeMap = {};
    sensorRes.recordset.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key !== "timestamp" && key !== "id" && row[key] != null) {
          activeMap[key] = (activeMap[key] || 0) + 1;
        }
      });
    });

    const summary = {};
    Object.values(tagMap).forEach(({ plant, tags }) => {
      const total = tags.length;
      const active = tags.filter((tag) => activeMap[tag]).length;
      if (!summary[plant]) summary[plant] = { total: 0, active: 0 };
      summary[plant].total += total;
      summary[plant].active += active;
    });

    const result = {};
    for (const [plant, stats] of Object.entries(summary)) {
      result[plant] = stats.total > 0
        ? Math.round((stats.active / stats.total) * 100)
        : 0;
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ getStatusSummary error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Line-wise machine running/stopped status (used in LineStatusBarChart.jsx)
export const getLineStatusByPlant = async (req, res) => {
  const { plant } = req.query;
  if (!plant) return res.status(400).json({ success: false, message: "Missing plant param" });

  try {
    const pool = await getConnection();
    const thresholds = await pool.request()
      .input("plant", sql.VarChar, plant)
      .query(`SELECT machine, line, tag_name FROM cbm_tag_thresholds WHERE plant = @plant`);

    const sensorData = await pool.request().query(`
      SELECT * FROM cbm_sensor_data WHERE timestamp >= DATEADD(MINUTE, -60, GETDATE())
    `);

    const grouped = {};
    thresholds.recordset.forEach(({ line, tag_name }) => {
      if (!grouped[line]) grouped[line] = { Running: 0, Stopped: 0 };
      const isActive = sensorData.recordset.some(row => row[tag_name] !== null);
      grouped[line][isActive ? 'Running' : 'Stopped']++;
    });

    const result = Object.entries(grouped).map(([line, counts]) => ({ line, ...counts }));
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ getLineStatusByPlant error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Tag-wise health classification (Normal / Warning / Critical) (used in TagStatusPieChart.jsx)
export const getTagHealthByPlant = async (req, res) => {
  const { plant } = req.query;
  if (!plant) return res.status(400).json({ success: false, message: "Missing plant param" });

  try {
    const pool = await getConnection();
    const thresholds = await pool.request()
      .input("plant", sql.VarChar, plant)
      .query(`SELECT machine, tag_name, min_value, max_value FROM cbm_tag_thresholds WHERE plant = @plant`);

    const sensorData = await pool.request().query(`
      SELECT TOP 1 * FROM cbm_sensor_data ORDER BY timestamp DESC
    `);

    const row = sensorData.recordset[0];
    const summary = { Normal: 0, Warning: 0, Critical: 0 };

    thresholds.recordset.forEach(({ tag_name, min_value, max_value }) => {
      const val = row[tag_name];
      if (val == null) return;
      if (val < min_value * 0.9 || val > max_value * 1.1) summary.Critical++;
      else if (val < min_value || val > max_value) summary.Warning++;
      else summary.Normal++;
    });

    const result = Object.entries(summary).map(([name, value]) => ({ name, value }));
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ getTagHealthByPlant error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
