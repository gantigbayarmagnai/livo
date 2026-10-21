import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { hashPassword, temporaryPassword, verifyPassword } from "./password";
import { can, homeFor, type Permission } from "./roles";

export { hashPassword, temporaryPassword, verifyPassword };

const { users, sessions } = schema;

export const SESSION_COOKIE = "livo_session";
const SESSION_DAYS = 30;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
export const MIN_PASSWORD = 10;

/* ---------- Sessions ---------- */

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  // Opportunistic cleanup of this user's expired sessions.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.LIVO_INSECURE_COOKIES !== "1",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** End every session a user has (after a password reset or deactivation). */
export async function endAllSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export type CurrentUser = Pick<User, "id" | "email" | "name" | "role" | "driverId" | "mustChangePassword">;

/** The signed-in user for this request, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      driverId: users.driverId,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true)));
  return row ?? null;
});

/**
 * For pages: the signed-in user with the given permission, or a redirect
 * (to sign in, to their own home, or to change a temporary password).
 */
export async function requirePage(permission: Permission | null, opts: { allowTempPassword?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowTempPassword) redirect("/account?first=1");
  if (permission && !can(user.role, permission)) redirect(homeFor(user.role));
  return user;
}

export class NotAllowedError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "NotAllowedError";
  }
}

/** For server actions: the signed-in user with the given permission, or an error. */
export async function requireAction(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new NotAllowedError("Your session ended. Sign in again.");
  if (!can(user.role, permission)) throw new NotAllowedError();
  return user;
}

/* ---------- Sign-in with lockout ---------- */

export type SignInResult = { ok: true; user: User } | { ok: false; error: string };

export async function checkCredentials(emailRaw: string, password: string): Promise<SignInResult> {
  const email = emailRaw.trim().toLowerCase();
  const generic = { ok: false as const, error: "That email and password don't match." };
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    // Spend the same time as a real check so emails can't be probed by timing.
    await verifyPassword(password, "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
    return generic;
  }
  if (!user.active) return { ok: false, error: "This account is turned off. Ask the owner to turn it back on." };
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `Too many wrong passwords. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED;
    await db
      .update(users)
      .set({ failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null })
      .where(eq(users.id, user.id));
    return lock ? { ok: false, error: `Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes.` } : generic;
  }
  await db
    .update(users)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  return { ok: true, user };
}

export async function userCount() {
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length;
}
