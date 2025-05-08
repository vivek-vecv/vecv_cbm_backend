import express from "express";
import {
  getMachinesByPlantLine,
  getLinesByPlant,
  getMachineStatuses
} from "../controllers/machineController.js";

const router = express.Router();

router.get("/", getMachinesByPlantLine);      // /api/machines
router.get("/lines", getLinesByPlant);   
router.get("/status", getMachineStatuses);     // /api/machines/lines
router.get("/test", (req, res) => {
    console.log("✅ machineRoutes is loaded");
    res.json({ success: true, msg: "Machine test route working" });
  });
export default router;
