import express from "express";
import { getUnresolvedAlerts, clearAllAlerts } from "../controllers/alertController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/alerts", verifyToken, getUnresolvedAlerts);
router.post("/alerts/clear", verifyToken, clearAllAlerts);

export default router;
