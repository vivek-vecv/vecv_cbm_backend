import { getConnection, sql } from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const login = async (req, res) => {
    const { username, password } = req.body;
    console.log("🔐 Login attempt:", username);
  
    try {
      const pool = await getConnection();
      const result = await pool
        .request()
        .input("username", sql.VarChar, username)
        .query("SELECT * FROM user_master WHERE username = @username");
  
      console.log("🔍 DB Result:", result.recordset);
  
      if (result.recordset.length === 0) {
        return res.status(401).json({ success: false, message: "User not found" });
      }
  
      const user = result.recordset[0];
      console.log("🧑 Found User:", user);
  
      const isMatch = await bcrypt.compare(password, user.password_hash);
      console.log("🔑 Password Match:", isMatch);
  
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }
  
      const token = jwt.sign(
        { username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );
  
      res.json({
        success: true,
        token,
        user: {
          username: user.username,
          role: user.role,
        },
      });
    } catch (err) {
      console.error("❌ Login Error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  