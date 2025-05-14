import { getConnection, sql } from "../db.js";

export const getLatestSensorData = async (req, res) => {
  try {
    console.log("📡 Hit /api/sensors/latest");
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT TOP 1 * 
      FROM cbm_sensor_data 
      ORDER BY timestamp DESC
    `);

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("❌ Failed to fetch sensor data", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getSensorHistory = async (req, res) => {
  const { plant, machine, tags, minutes } = req.query;

  if (!plant || !machine || !tags) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required query parameters." });
  }

  const tagList = tags.split(",").map((tag) => tag.trim());
  const minutesAgo = parseInt(minutes) || 60;
  const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);

  try {
    const pool = await getConnection();

    const request = pool.request();
    request.input("cutoffTime", sql.DateTime, cutoffTime);

    const result = await request.query(`
      SELECT TOP 1000 *
      FROM cbm_sensor_data
      WHERE timestamp >= @cutoffTime
      ORDER BY timestamp ASC
    `);

    const rawRows = result.recordset;

    // Transform data into tag-wise time-series
    const grouped = {};
    for (const tag of tagList) {
      grouped[tag] = rawRows.map((row) => ({
        time: row.timestamp,
        value: row[tag] !== undefined ? row[tag] : null,
      }));
    }

    res.json({ success: true, data: grouped });
  } catch (err) {
    console.error("❌ getSensorHistory error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
