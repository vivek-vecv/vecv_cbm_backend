import bcrypt from "bcryptjs";

const hashPassword = async () => {
  const hashed = await bcrypt.hash("admin", 10);
  console.log("✅ Hashed Password:", hashed);
};

hashPassword();
