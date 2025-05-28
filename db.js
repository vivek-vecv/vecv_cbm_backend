import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const config = {
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  authentication: {
    type: "ntlm",
    options: {
      domain: process.env.DB_DOMAIN,
      userName: process.env.DB_USER,
      password: process.env.DB_PASS,
    },
  },
  options: {
    encrypt: true,
    trustServerCertificate: true,
    requestTimeout: 60000,
    connectionTimeout: 30000,
  },
};

export const getConnection = async () => {
  try {
    const pool = await sql.connect(config);
    return pool;
  } catch (error) {
    console.error("❌ MSSQL Connection Error:", error);
    throw error;
  }
};

export { sql };
