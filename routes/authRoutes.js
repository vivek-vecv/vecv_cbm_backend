import express from "express";
import { loginUser, registerUser, getUsers, deleteUser } from "../controllers/authController.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { verifyAdmin } from "../middleware/verifyAdmin.js";


const router = express.Router();
//const verifyToken = require("../middleware/authMiddleware");

// Public login route
router.post("/login", loginUser);

// Admin-only routes
router.post("/register", verifyToken, verifyAdmin, registerUser);
router.get("/users", verifyToken, verifyAdmin, getUsers);
router.delete("/users/:username", verifyToken, verifyAdmin, deleteUser);

export default router;
