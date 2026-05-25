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

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const checkEmail = String(email).toLowerCase().trim();
    const checkPassword = String(password).trim();

    // Preserve the dynamic admin behavior from Express server.ts
    if (
      checkEmail === "kmulatu21@gmail.com" &&
      checkPassword === "admin@docmind"
    ) {
      let existing = db.getUserByEmail("kmulatu21@gmail.com");
      const hashedPassword = bcrypt.hashSync("admin@docmind", 10);

      if (!existing) {
        existing = db.createUser({
          id: `usr-${Date.now()}`,
          name: "Kmulatu Admin",
          email: "kmulatu21@gmail.com",
          password: hashedPassword,
          role: "admin",
          createdAt: new Date().toISOString(),
          promptCount: 0,
          tier: "premium",
          paymentStatus: "approved",
        });
      } else {
        const passwordMatches = await bcrypt.compare(
          "admin@docmind",
          existing.password,
        );
        if (
          existing.role !== "admin" ||
          existing.tier !== "premium" ||
          !passwordMatches
        ) {
          existing = db.updateUser({
            id: existing.id,
            role: "admin",
            tier: "premium",
            paymentStatus: "approved",
            password: hashedPassword,
          });
        }
      }

      const token = jwt.sign(
        { id: existing.id, email: existing.email, role: existing.role },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      return res.json({
        user: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          role: existing.role,
          createdAt: existing.createdAt,
          promptCount: existing.promptCount || 0,
          tier: existing.tier || "premium",
          paymentStatus: existing.paymentStatus || "approved",
          paymentPlanRequested: existing.paymentPlanRequested || null,
          paymentTxId: existing.paymentTxId || null,
          paymentDate: existing.paymentDate || null,
        },
        token,
      });
    }

    const user = db.getUserByEmail(checkEmail);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(checkPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        promptCount: user.promptCount || 0,
        tier: user.tier || "free",
        paymentStatus: user.paymentStatus || "none",
        paymentPlanRequested: user.paymentPlanRequested || null,
        paymentTxId: user.paymentTxId || null,
        paymentDate: user.paymentDate || null,
      },
      token,
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Internal server error" });
  }
}
