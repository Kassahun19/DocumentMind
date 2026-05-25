import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../../../src/server/db";

const JWT_SECRET =
  process.env.JWT_SECRET || "documind_ai_secret_encryption_key_2026";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "All fields (name, email, password) are required" });
    }

    const checkEmail = String(email).toLowerCase().trim();
    const userName = String(name).trim();
    const userPassword = String(password);

    const existingUser = db.getUserByEmail(checkEmail);
    if (existingUser) {
      return res.status(409).json({ error: "Email address is already in use" });
    }

    const hashedPassword = await bcrypt.hash(userPassword, 10);
    const id =
      Date.now().toString() + Math.round(Math.random() * 1000).toString();

    const newUser: any = {
      id,
      name: userName,
      email: checkEmail,
      password: hashedPassword,
      role: "user",
      createdAt: new Date().toISOString(),
      promptCount: 0,
      tier: "free",
      paymentStatus: "none",
      paymentPlanRequested: null,
      paymentTxId: null,
      paymentDate: null,
    };

    db.createUser(newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(201).json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
        promptCount: 0,
        tier: "free",
        paymentStatus: "none",
        paymentPlanRequested: null,
        paymentTxId: null,
        paymentDate: null,
      },
      token,
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Internal server error" });
  }
}
