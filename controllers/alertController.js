import { getConnection, sql } from "../db.js";

export const getUnresolvedAlerts = async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT id, plant, machine, tag_name, value, time_triggered
      FROM cbm_alerts
      WHERE resolved_flag = 0
      ORDER BY time_triggered DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("❌ Error fetching alerts:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const clearAllAlerts = async (req, res) => {
    try {
      const pool = await getConnection();
      await pool.request().query(`
        UPDATE cbm_alerts SET resolved_flag = 1 WHERE resolved_flag = 0
      `);
      res.json({ success: true, message: "All alerts cleared" });
    } catch (err) {
      console.error("❌ Error clearing alerts:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  