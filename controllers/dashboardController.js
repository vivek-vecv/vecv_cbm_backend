// controllers/dashboardController.js
import { getConnection, sql } from "../db.js";

// -----------------------------
// ✅ Caching Setup
// -----------------------------
let cachedLineStatus = {};
let cachedSummary = {};
const CACHE_DURATION = 30000; // 30 seconds

// -----------------------------
// ✅ Get Status Summary (Plant Cards)
// -----------------------------
export const getStatusSummary = async (req, res) => {
  const { plant } = req.query;
  if (!plant)
    return res
      .status(400)
      .json({ success: false, message: "Missing plant param" });

  const now = Date.now();
  if (
    cachedSummary[plant] &&
    now - cachedSummary[plant].timestamp < CACHE_DURATION
  ) {
    console.log(`✅ [CACHE] StatusSummary for plant: ${plant}`);
    return res.json({ success: true, data: cachedSummary[plant].data });
  }

  try {
    const pool = await getConnection();
    const start = Date.now();

    const thresholdRes = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .query(`SELECT tag_name FROM cbm_tag_thresholds WHERE plant = @plant`);

    const tagList = thresholdRes.recordset.map((row) => row.tag_name);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const sensorRes = await pool.request().query(`
      SELECT TOP 5000 * FROM cbm_sensor_data WHERE timestamp >= '${oneHourAgo.toISOString()}'
    `);

    const activeMap = {};
    sensorRes.recordset.forEach((row) => {
      tagList.forEach((tag) => {
        if (row[tag] != null) activeMap[tag] = true;
      });
    });

    const activeCount = tagList.filter((tag) => activeMap[tag]).length;
    const total = tagList.length;
    const percent = total > 0 ? Math.round((activeCount / total) * 100) : 0;

    const result = { [plant]: percent };
    cachedSummary[plant] = { timestamp: now, data: result };

    console.log(`⏱️ getStatusSummary executed in ${Date.now() - start}ms`);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ getStatusSummary error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------
// ✅ Line-wise Running/Stopped Chart
// -----------------------------
export const getLineStatusByPlant = async (req, res) => {
  const { plant } = req.query;
  if (!plant)
    return res
      .status(400)
      .json({ success: false, message: "Missing plant param" });

  const now = Date.now();
  if (
    cachedLineStatus[plant] &&
    now - cachedLineStatus[plant].timestamp < CACHE_DURATION
  ) {
    console.log(`✅ [CACHE] LineStatus for plant: ${plant}`);
    return res.json({ success: true, data: cachedLineStatus[plant].data });
  }

  try {
    const pool = await getConnection();
    const start = Date.now();

    const thresholds = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .query(
        `SELECT machine, line, tag_name FROM cbm_tag_thresholds WHERE plant = @plant`
      );

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sensorRes = await pool.request().query(`
      SELECT TOP 5000 * FROM cbm_sensor_data WHERE timestamp >= '${oneHourAgo.toISOString()}'
    `);

    const sensorRows = sensorRes.recordset;
    const tagPresence = {};

    sensorRows.forEach((row) => {
      thresholds.recordset.forEach(({ tag_name }) => {
        if (row[tag_name] != null) tagPresence[tag_name] = true;
      });
    });

    const grouped = {};
    thresholds.recordset.forEach(({ line, tag_name }) => {
      if (!grouped[line]) grouped[line] = { Running: 0, Stopped: 0 };
      grouped[line][tagPresence[tag_name] ? "Running" : "Stopped"]++;
    });

    const result = Object.entries(grouped).map(([line, counts]) => ({
      line,
      ...counts,
    }));
    cachedLineStatus[plant] = { timestamp: now, data: result };

    console.log(`⏱️ getLineStatusByPlant executed in ${Date.now() - start}ms`);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ getLineStatusByPlant error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------
// ✅ Tag Status (Pie Chart)
// -----------------------------
export const getTagHealthByPlant = async (req, res) => {
  const { plant } = req.query;
  if (!plant)
    return res
      .status(400)
      .json({ success: false, message: "Missing plant param" });

  try {
    const pool = await getConnection();
    const thresholds = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .query(
        `SELECT machine, tag_name, min_value, max_value FROM cbm_tag_thresholds WHERE plant = @plant`
      );

    const sensorRes = await pool.request().query(`
      SELECT TOP 1 * FROM cbm_sensor_data ORDER BY timestamp DESC
    `);

    const row = sensorRes.recordset[0];
    const summary = { Normal: 0, Warning: 0, Critical: 0 };

    thresholds.recordset.forEach(({ tag_name, min_value, max_value }) => {
      const val = row[tag_name];
      if (val == null) return;
      if (val < min_value * 0.9 || val > max_value * 1.1) summary.Critical++;
      else if (val < min_value || val > max_value) summary.Warning++;
      else summary.Normal++;
    });

    const result = Object.entries(summary).map(([name, value]) => ({
      name,
      value,
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ getTagHealthByPlant error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
