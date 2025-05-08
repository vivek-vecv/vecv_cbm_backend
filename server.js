import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { getConnection } from "./db.js";
import thresholdRoutes from "./routes/thresholdRoutes.js";
// ✅ import routes AFTER setting up express
import authRoutes from "./routes/authRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import cron from "node-cron";
import { runAlertCheck } from "./cron/alertJob.js";
//import thresholdRoutes from './routes/thresholdRoutes.js';
import sensorRoutes from "./routes/sensorRoutes.js";
import machineRoutes from "./routes/machineRoutes.js";
import dashboardRoutes from './routes/dashboardRoutes.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Cron runs every 2 minutes
cron.schedule("*/2 * * * *", () => {
    runAlertCheck();
  });

// ✅ middlewares
app.use(cors());
app.use(express.json());

// ✅ routes
app.use("/api", authRoutes);
app.use("/api", thresholdRoutes);
app.use("/api", alertRoutes);
app.use("/api/sensors", sensorRoutes);
app.use("/api/machines", machineRoutes);
app.use('/api/dashboard', dashboardRoutes);

console.log("📦 machineRoutes mounted at /api/machines");
// ✅ test route
app.get("/", (req, res) => {
  res.send("✅ CBM Backend API is running.");
});

// ✅ DB test
app.get("/api/db-test", async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query("SELECT TOP 1 * FROM cbm_sensor_data ORDER BY id DESC");
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("DB Test Error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

// ✅ start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
