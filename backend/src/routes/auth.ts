import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/database.js";
import { generateToken, authMiddleware, AuthRequest } from "../middleware/auth.js";
import { verifyTwentyUser } from "../db/twenty-pg.js";

const router = Router();

/**
 * Login — verifies credentials against Twenty's own `core."user"` table.
 *
 * Twenty is the source of truth for who can log in. The dialer never
 * stores passwords; it delegates entirely to Twenty's `passwordHash`
 * (bcrypt). On success we upsert a lightweight cache row in `profiles`
 * so the rest of the dialer can reference a local id, and mint a JWT
 * carrying both the local id and the Twenty user id.
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    let twentyUser;
    try {
      twentyUser = await verifyTwentyUser(email, password);
    } catch (err: any) {
      // TWENTY_DATABASE_URL missing or pool error
      res.status(503).json({
        error: err.message ?? "Authentication service unavailable",
        code: "AUTH_SERVICE_UNAVAILABLE",
      });
      return;
    }

    if (!twentyUser) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Upsert a local cache row keyed by the Twenty user id, so leads,
    // call logs, etc. can reference a stable local id.
    const fullName = [twentyUser.firstName, twentyUser.lastName]
      .filter(Boolean)
      .join(" ") || twentyUser.email;

    const existing = db
      .prepare("SELECT id FROM profiles WHERE id = ?")
      .get(twentyUser.id) as { id: string } | undefined;

    if (existing) {
      db.prepare(
        "UPDATE profiles SET email = ?, full_name = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(twentyUser.email, fullName, twentyUser.id);
    } else {
      db.prepare(
        "INSERT INTO profiles (id, email, full_name, role) VALUES (?, ?, ?, 'agent')",
      ).run(twentyUser.id, twentyUser.email, fullName);
    }

    const token = generateToken({
      userId: twentyUser.id,
      twentyUserId: twentyUser.id,
    });
    res.json({
      user: {
        id: twentyUser.id,
        email: twentyUser.email,
        fullName,
        role: "agent",
      },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Signup is disabled — members are created in Twenty, not in the dialer.
 * Twenty is the source of truth for who can log in.
 */
router.post("/signup", (_req, res) => {
  res.status(403).json({
    error:
      "Sign up is disabled. Create the member in Twenty, then log in with their Twenty credentials.",
  });
});

router.get("/me", authMiddleware, (req: AuthRequest, res) => {
  const user = db.prepare("SELECT * FROM profiles WHERE id = ?").get(req.userId!) as any;
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    twentyUserId: req.twentyUserId,
  });
});

export default router;
