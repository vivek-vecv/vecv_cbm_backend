import express from "express";
import { login } from "../controllers/authController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router(); // ✅ define router first

// 🔐 Login route
router.post("/login", login);


export default router;
