// controllers/sensorController.js
import { getConnection, sql } from "../db.js";

let cachedSensorData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

// 🔁 Retry logic for deadlocks or timeouts
const runQueryWithRetry = async (request, query, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await request.query(query);
    } catch (err) {
      if (
        err.code === "ETIMEOUT" ||
        (err.code === "EREQUEST" && err.message.includes("deadlocked"))
      ) {
        console.warn(`⚠️ Query retry due to ${err.code} on attempt ${i + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw err;
    }
  }
  return null;
};

// ✅ Latest sensor data with 30s cache
export const getLatestSensorData = async (req, res) => {
  console.log("📡 Hit /api/sensors/latest");
  const now = Date.now();

  if (cachedSensorData && now - lastFetchTime < CACHE_DURATION) {
    console.log("✅ Serving cached sensor data");
    return res.json({ success: true, data: cachedSensorData });
  }

  try {
    const pool = await getConnection();
    const request = pool.request();
    const start = Date.now();

    const query = `
      SELECT TOP 1 * 
      FROM cbm_sensor_data 
      ORDER BY timestamp DESC
    `;

    const result = await runQueryWithRetry(request, query);
    if (!result || !result.recordset) {
      throw new Error("No data returned from sensor query");
    }

    console.log(`⏱️ Sensor query took ${Date.now() - start} ms`);

    cachedSensorData = result.recordset[0];
    lastFetchTime = now;

    res.json({ success: true, data: cachedSensorData });
  } catch (err) {
    console.error("❌ Failed to fetch sensor data", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ✅ Sensor history for specific tags & duration
export const getSensorHistory = async (req, res) => {
  const { plant, machine, tags, minutes } = req.query;

  if (!plant || !machine || !tags) {
    return res.status(400).json({
      success: false,
      message: "Missing required query parameters: plant, machine, tags",
    });
  }

  const tagList = tags.split(",").map((tag) => tag.trim());
  const minutesAgo = parseInt(minutes) || 60;
  const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);

  try {
    const pool = await getConnection();
    const request = pool.request();
    request.input("cutoffTime", sql.DateTime, cutoffTime);

    const tagFilter = tagList.map((tag) => `[${tag}]`).join(", ");
    const query = `
      SELECT timestamp, ${tagFilter}
      FROM cbm_sensor_data
      WHERE timestamp >= @cutoffTime
      ORDER BY timestamp ASC
    `;

    const start = Date.now();
    const result = await runQueryWithRetry(request, query);
    if (!result || !result.recordset) {
      throw new Error("Sensor history query failed or returned no data.");
    }

    console.log(`⏱️ Sensor history query took ${Date.now() - start} ms`);

    const rawRows = result.recordset;
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
