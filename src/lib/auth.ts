import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";

export type SessionUser = {
  id: number;
  username: string;
};

const COOKIE_NAME = "notifyflow_session";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET is not set. Add it to your .env files.");
}

const seedUsers = [
  { username: "user1", password: "user1password" },
  { username: "user2", password: "user2password" },
  { username: "user3", password: "user3password" },
];

async function ensureSeedUsers() {
  // Make auth self-contained for this assessment:
  // create the `users` table and add `events.user_id` if they don't exist yet.
  // This prevents a hard failure after updating the code.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
  `);

  for (const u of seedUsers) {
    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [u.username]
    );

    if (existing.rows.length > 0) continue;

    const passwordHash = await bcrypt.hash(u.password, 10);
    await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
      [u.username, passwordHash]
    );
  }
}

function signSession(user: SessionUser) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    jwtSecret as string,
    {
    algorithm: "HS256",
    expiresIn: "7d",
    }
  );
}

export function setSessionCookie(user: SessionUser) {
  const token = signSession(user);
  const cookieStore = cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getSessionUserFromCookie(): SessionUser | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret as string);

    // jsonwebtoken's `verify()` return type can be `string | JwtPayload`.
    // For our session tokens, we always expect an object payload.
    if (typeof decoded === "string" || !decoded || typeof decoded !== "object") {
      return null;
    }

    const payload = decoded as {
      sub?: number | string;
      username?: unknown;
    };

    if (typeof payload.sub !== "number") return null;
    if (typeof payload.username !== "string") return null;

    return { id: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser | null> {
  // Seed only on login/first access. This keeps the demo setup simple.
  // If the users table doesn't exist yet, you will see a DB error,
  // which is expected until you run the migration SQL.
  await ensureSeedUsers();

  const user = getSessionUserFromCookie();
  return user;
}

export async function authenticate(username: string, password: string) {
  await ensureSeedUsers();

  const result = await pool.query(
    "SELECT id, username, password_hash FROM users WHERE username = $1",
    [username]
  );

  const row = result.rows[0];
  if (!row) return null;

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;

  return { id: row.id as number, username: row.username as string } satisfies SessionUser;
}

