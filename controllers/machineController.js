import { getConnection } from "../db.js";

// Fetch distinct machines filtered by plant, line, and optionally machine
export const getMachinesByPlantLine = async (req, res) => {
    const { plant, line, machine } = req.query;
  
    console.log("🔍 Query Params Received:", { plant, line, machine });
  
    try {
      const pool = await getConnection();
  
      let query = `
        SELECT DISTINCT machine, line
        FROM cbm_tag_thresholds
        WHERE plant = @plant
      `;
  
      if (line) query += " AND line = @line";
      if (machine) query += " AND machine = @machine";
  
      console.log("🛠️ Final SQL Query:", query);
  
      const request = pool.request().input("plant", plant);
      if (line) request.input("line", line);
      if (machine) request.input("machine", machine);
  
      const result = await request.query(query);
      console.log("📤 Result from DB:", result.recordset);
  
      res.json({ success: true, machines: result.recordset });
    } catch (err) {
      console.error("❌ Failed to fetch machines:", err);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  };

// GET /api/lines?plant=ETB
export const getLinesByPlant = async (req, res) => {
    const { plant } = req.query;
  
    if (!plant) {
      return res.status(400).json({ success: false, message: "Plant is required" });
    }
  
    try {
      const pool = await sql.connect(dbConfig);
      const result = await pool.request()
        .input("plant", sql.VarChar, plant)
        .query(`
          SELECT DISTINCT line 
          FROM cbm_tag_thresholds 
          WHERE plant = @plant AND line IS NOT NULL
        `);
  
      const lines = result.recordset.map(r => r.line);
      return res.json({ success: true, lines });
    } catch (err) {
      console.error("Failed to fetch lines:", err);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  };
  
// /api/machines/status?plant=ETB
export const getMachineStatuses = async (req, res) => {
  const { plant } = req.query;
  if (!plant) {
    return res.status(400).json({ success: false, message: "Plant is required" });
  }

  try {
    const pool = await getConnection();

    const thresholdsRes = await pool.request()
      .input("plant", plant)
      .query(`
        SELECT DISTINCT machine, tag_name, line
        FROM cbm_tag_thresholds
        WHERE plant = @plant
      `);

    const sensorRes = await pool.request().query(`
      SELECT TOP 1 * FROM cbm_sensor_data ORDER BY timestamp DESC
    `);

    const sensorRow = sensorRes.recordset[0];

    const statusMap = {};

    thresholdsRes.recordset.forEach(({ machine, tag_name, line }) => {
      if (!statusMap[machine]) {
        statusMap[machine] = { name: machine, line, status: "Stopped" };
      }

      if (sensorRow[tag_name] != null) {
        statusMap[machine].status = "Running";
      }
    });

    const machineList = Object.values(statusMap);

    res.json({ success: true, machines: machineList });
  } catch (err) {
    console.error("❌ getMachineStatuses error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
