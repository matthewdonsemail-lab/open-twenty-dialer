import { Pool } from "pg";
import bcrypt from "bcryptjs";

let pool: Pool | null = null;

export type TwentyUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isEmailVerified: boolean;
};

export interface TwentyPgStatus {
  configured: boolean;
  message: string;
}

export function getTwentyPgStatus(): TwentyPgStatus {
  const url = process.env.TWENTY_DATABASE_URL;
  if (!url) {
    return {
      configured: false,
      message:
        "TWENTY_DATABASE_URL is not set — Twenty credential verification is disabled.",
    };
  }
  return {
    configured: true,
    message: "Configured to connect to Twenty Postgres",
  };
}

function getPool(): Pool | null {
  if (pool) return pool;

  const connectionString = process.env.TWENTY_DATABASE_URL;
  if (!connectionString) {
    console.warn("[twenty-pg] TWENTY_DATABASE_URL is not set");
    return null;
  }

  try {
    pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000 });
    pool.on("error", (err) => console.error("[twenty-pg] pool error:", err));
  } catch (err) {
    console.error("[twenty-pg] failed to create pool:", err);
    return null;
  }

  return pool;
}

/**
 * Verify an email/password pair against Twenty's `core."user"` table.
 * Returns the user row on success, or null if the credentials are
 * invalid, the account is disabled, or no password hash is set.
 */
export async function verifyTwentyUser(
  email: string,
  password: string,
): Promise<TwentyUser | null> {
  const pool = getPool();
  if (!pool) {
    throw new Error(
      "Server is not configured to verify Twenty credentials. " +
      "Set TWENTY_DATABASE_URL to the read-only Postgres connection " +
      "for your Twenty instance.",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  try {
    const res = await pool.query(
      `SELECT id, email, "passwordHash", "firstName", "lastName",
              "isEmailVerified", disabled
       FROM core."user"
       WHERE email = LOWER($1) AND "deletedAt" IS NULL`,
      [normalizedEmail],
    );

    const row = res.rows[0];
    if (!row || !row.passwordHash || row.disabled) return null;

    const ok = await bcrypt.compare(password, row.passwordHash);
    return ok
      ? {
          id: row.id,
          email: row.email,
          firstName: row.firstName ?? null,
          lastName: row.lastName ?? null,
          isEmailVerified: !!row.isEmailVerified,
        }
      : null;
  } catch (error) {
    console.error("[twenty-pg] query error:", error);
    return null;
  }
}

export async function closeTwentyPg(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
