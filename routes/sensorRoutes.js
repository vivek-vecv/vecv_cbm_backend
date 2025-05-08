import express from "express";
import { getLatestSensorData, getSensorHistory } from "../controllers/sensorController.js";
const router = express.Router();

router.get("/latest", getLatestSensorData);
router.get("/history", getSensorHistory); //
export default router;
