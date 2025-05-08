import express from 'express';
import { getConnection, sql } from "../db.js";
import { getThresholdsByMachine } from "../controllers/thresholdController.js";




const router = express.Router();
router.get("/thresholds/by-machine", getThresholdsByMachine);

router.get('/thresholds', async (req, res) => {
  const { plant, machine } = req.query;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('plant', sql.VarChar, plant)
      .input('machine', sql.VarChar, machine)
      .query(`
        SELECT tag_name, min_value, max_value, gauge_min, gauge_max
        FROM cbm_tag_thresholds
        WHERE plant = @plant AND machine = @machine
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Threshold API error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
