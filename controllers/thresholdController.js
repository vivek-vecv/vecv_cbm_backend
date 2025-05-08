import { getConnection, sql } from "../db.js";

// ✅ GET handler
export const getThresholds = async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        plant,
        machine,
        tag_name,
        min_value,
        max_value,
        gauge_min,
        gauge_max,
        updated_by,
        updated_at
      FROM cbm_tag_thresholds
      ORDER BY plant, machine, tag_name
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("❌ Error fetching thresholds:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ POST handler (already done)
export const updateThresholds = async (req, res) => {
  const updatedBy = req.user.username;
  const payload = Array.isArray(req.body) ? req.body : [req.body];

  try {
    const pool = await getConnection();
    const queries = payload.map((row) => {
      const { plant, machine, tag_name, min_value, max_value, gauge_min, gauge_max } = row;

      return pool.request()
        .input("plant", sql.VarChar, plant)
        .input("machine", sql.VarChar, machine)
        .input("tag_name", sql.VarChar, tag_name)
        .input("min_value", sql.Float, min_value)
        .input("max_value", sql.Float, max_value)
        .input("gauge_min", sql.Float, gauge_min)
        .input("gauge_max", sql.Float, gauge_max)
        .input("updated_by", sql.VarChar, updatedBy)
        .query(`
          MERGE cbm_tag_thresholds AS target
          USING (SELECT @plant AS plant, @machine AS machine, @tag_name AS tag_name) AS source
          ON target.plant = source.plant AND target.machine = source.machine AND target.tag_name = source.tag_name
          WHEN MATCHED THEN
            UPDATE SET 
              min_value = @min_value,
              max_value = @max_value,
              gauge_min = @gauge_min,
              gauge_max = @gauge_max,
              updated_by = @updated_by,
              updated_at = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (plant, machine, tag_name, min_value, max_value, gauge_min, gauge_max, updated_by, updated_at)
            VALUES (@plant, @machine, @tag_name, @min_value, @max_value, @gauge_min, @gauge_max, @updated_by, GETDATE());
        `);
    });

    await Promise.all(queries);
    res.json({ success: true, message: "Thresholds updated successfully" });

  } catch (err) {
    console.error("❌ Error updating thresholds:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getThresholdsByMachine = async (req, res) => {
  const { name, line } = req.query;

  if (!name || !line) {
    return res.status(400).json({ success: false, message: "Missing machine name or line." });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("machine", sql.VarChar, name)
      .query(`
        SELECT tag_name, min_value, max_value, gauge_min, gauge_max
        FROM cbm_tag_thresholds
        WHERE machine = @machine
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("❌ getThresholdsByMachine error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};