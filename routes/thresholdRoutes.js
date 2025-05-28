import express from "express";
import { getConnection, sql } from "../db.js";
import {
  getThresholdsByMachine,
  updateThresholds,
  getThresholds,
} from "../controllers/thresholdController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/thresholds/all", getThresholds);
// ✅ Get all thresholds for a specific plant & machine
router.get("/thresholds", async (req, res) => {
  const { plant, machine } = req.query;

  if (!plant || !machine) {
    return res
      .status(400)
      .json({ message: "Missing plant or machine parameter" });
  }

  try {
    const pool = await getConnection();
    const result = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .input("machine", sql.VarChar, machine).query(`
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

// ✅ Get thresholds by machine name and line
router.get("/thresholds/by-machine", getThresholdsByMachine);

// ✅ Update or insert thresholds (protected)
router.post("/thresholds", verifyToken, updateThresholds);

export default router;
