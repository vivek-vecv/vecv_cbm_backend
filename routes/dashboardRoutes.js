// routes/dashboardRoutes.js
import express from 'express';
import {
  getStatusSummary,
  getLineStatusByPlant,
  getTagHealthByPlant,
} from '../controllers/dashboardController.js';

const router = express.Router();

// ✅ Plant-wise summary for PlantCards.jsx
router.get('/status-summary', getStatusSummary);

// ✅ Line-wise status for LineStatusBarChart.jsx
router.get('/line-status', getLineStatusByPlant);

// ✅ Tag-wise pie status for TagStatusPieChart.jsx
router.get('/tag-health', getTagHealthByPlant);

export default router;
