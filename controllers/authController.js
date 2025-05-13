// File: controllers/authController.js
import { getConnection, sql } from "../db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const SECRET = process.env.JWT_SECRET || "cbm_secret_key";
const TOKEN_EXPIRY = "1h";

// 🔐 Login controller
export const loginUser = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: "Username and password required" });

  try {
    const pool = await getConnection();
    const result = await pool
      .request()
      .input("username", sql.VarChar, username)
      .query("SELECT * FROM user_master WHERE username = @username");

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign(
      { username: user.username, role: user.role },
      SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({ success: true, token, user: { username: user.username, role: user.role } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 👤 Create new user (admin-only)
export const registerUser = async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ success: false, message: "All fields required" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const pool = await getConnection();
    await pool.request()
      .input("username", sql.VarChar, username)
      .input("password_hash", sql.VarChar, hashed)
      .input("role", sql.VarChar, role)
      .query("INSERT INTO user_master (username, password_hash, role) VALUES (@username, @password_hash, @role)");

    res.json({ success: true, message: "User created" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 👥 Get all users (admin-only)
export const getUsers = async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query("SELECT username, role FROM user_master");
    res.json({ success: true, users: result.recordset });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ❌ Delete user (admin-only)
export const deleteUser = async (req, res) => {
  const { username } = req.params; // previously: const { id }

  try {
    const pool = await getConnection();
    await pool.request()
      .input("username", sql.VarChar, username)
      .query("DELETE FROM user_master WHERE username = @username");

    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

