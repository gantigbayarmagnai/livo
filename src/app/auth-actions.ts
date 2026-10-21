"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { userRole, type ReservationStatus } from "@/db/schema";
import {
  MIN_PASSWORD,
  checkCredentials,
  endAllSessions,
  endSession,
  getCurrentUser,
  hashPassword,
  requireAction,
  startSession,
  temporaryPassword,
  userCount,
  verifyPassword,
} from "@/lib/auth";
import { STATUS_LABELS } from "@/lib/labels";
import { homeFor } from "@/lib/roles";

const { users, reservations, reservationEvents, drivers } = schema;

export type AuthState = { error?: string; ok?: boolean; tempPassword?: string; forEmail?: string; email?: string };

/** Only allow redirects to our own pages. */
const safeNext = (v: unknown) => (typeof v === "string" && /^\/(?!\/)[\w\-/?=&.%]*$/.test(v) ? v : null);

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email.trim() || !password) return { error: "Enter your email and password.", email };
  const res = await checkCredentials(email, password);
  // Hand the email back so the form keeps it after a wrong password.
  if (!res.ok) return { error: res.error, email };
  await startSession(res.user.id);
  if (res.user.mustChangePassword) redirect("/account?first=1");
  redirect(safeNext(formData.get("next")) ?? homeFor(res.user.role));
}

export async function signOut() {
  await endSession();
  redirect("/login");
}

const newPassword = z
  .string()
  .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`)
  .max(200, "That password is too long.");

/** First run only: create the owner account. */
export async function setupOwner(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if ((await userCount()) > 0) return { error: "Livo is already set up. Sign in instead." };
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Add your name."),
      email: z.string().trim().toLowerCase().email("Enter a valid email."),
      password: newPassword,
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Re-check inside the insert so two people can't both become the first owner.
  const inserted = await db.execute(sql`
    INSERT INTO users (email, name, password_hash, role)
    SELECT ${parsed.data.email}, ${parsed.data.name}, ${await hashPassword(parsed.data.password)}, 'owner'
    WHERE NOT EXISTS (SELECT 1 FROM users)
    RETURNING id`);
  const id = (inserted.rows[0] as { id: string } | undefined)?.id;
  if (!id) return { error: "Livo is already set up. Sign in instead." };
  await startSession(id);
  redirect("/dispatch");
}

export async function changePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const current = String(formData.get("current") ?? "");
  const next = newPassword.safeParse(formData.get("password"));
  if (!next.success) return { error: next.error.issues[0].message };
  if (formData.get("password") !== formData.get("confirm")) return { error: "The two new passwords don't match." };
  const [row] = await db.select().from(users).where(eq(users.id, me.id));
  if (!row || !(await verifyPassword(current, row.passwordHash)))
    return { error: "Your current password isn't right." };
  if (current === next.data) return { error: "Pick a password different from the current one." };
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next.data), mustChangePassword: false })
    .where(eq(users.id, me.id));
  // Sign out other devices, keep this one.
  await endAllSessions(me.id);
  await startSession(me.id);
  if (me.mustChangePassword) redirect(homeFor(me.role));
  refresh();
  return { ok: true };
}

/* ---------- Team (owner only) ---------- */

export async function addUser(_prev: AuthState, formData: FormData): Promise<AuthState> {
  try {
    await requireAction("team");
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Add a name."),
      email: z.string().trim().toLowerCase().email("Enter a valid email."),
      role: z.enum(userRole.enumValues),
      driverId: z
        .string()
        .transform((v) => (v === "" ? null : v))
        .nullable()
        .optional(),
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.role === "chauffeur" && !d.driverId) return { error: "Pick which chauffeur record this person is." };
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email));
  if (exists) return { error: "Someone already uses that email." };
  const temp = temporaryPassword();
  await db.insert(users).values({
    name: d.name,
    email: d.email,
    role: d.role,
    driverId: d.role === "chauffeur" ? d.driverId : null,
    passwordHash: await hashPassword(temp),
    mustChangePassword: true,
  });
  refresh();
  return { ok: true, tempPassword: temp, forEmail: d.email };
}

async function ownersLeft(excludingId: string) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "owner"), eq(users.active, true), ne(users.id, excludingId)));
  return rows.length;
}

export async function resetUserPassword(userId: string): Promise<AuthState> {
  const me = await requireAction("team");
  if (userId === me.id) return { error: "Change your own password from your account page." };
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return { error: "That person no longer exists." };
  const temp = temporaryPassword();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(temp), mustChangePassword: true, failedLogins: 0, lockedUntil: null })
    .where(eq(users.id, userId));
  await endAllSessions(userId);
  refresh();
  return { ok: true, tempPassword: temp, forEmail: u.email };
}

export async function setUserActive(userId: string, active: boolean): Promise<AuthState> {
  const me = await requireAction("team");
  if (userId === me.id) return { error: "You can't turn off your own account." };
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return { error: "That person no longer exists." };
  if (!active && u.role === "owner" && (await ownersLeft(userId)) === 0)
    return { error: "Livo needs at least one owner." };
  await db.update(users).set({ active }).where(eq(users.id, userId));
  if (!active) await endAllSessions(userId);
  refresh();
  return { ok: true };
}

export async function setUserRole(userId: string, role: string, driverId: string | null): Promise<AuthState> {
  const me = await requireAction("team");
  const r = z.enum(userRole.enumValues).parse(role);
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return { error: "That person no longer exists." };
  if (u.role === "owner" && r !== "owner" && (await ownersLeft(userId)) === 0)
    return { error: "Livo needs at least one owner." };
  if (userId === me.id && r !== "owner") return { error: "You can't change your own role." };
  if (r === "chauffeur" && !driverId) return { error: "Pick which chauffeur record this person is." };
  if (driverId) {
    const [drv] = await db.select({ id: drivers.id }).from(drivers).where(eq(drivers.id, driverId));
    if (!drv) return { error: "That chauffeur record no longer exists." };
  }
  await db
    .update(users)
    .set({ role: r, driverId: r === "chauffeur" ? driverId : null })
    .where(eq(users.id, userId));
  await endAllSessions(userId); // pick up the new permissions on next sign-in
  refresh();
  return { ok: true };
}

/* ---------- Chauffeur: update my own trip ---------- */

const CHAUFFEUR_STEPS: ReservationStatus[] = ["en_route", "on_location", "passenger_on_board", "done"];

export async function updateMyTrip(reservationId: string, status: string): Promise<AuthState> {
  const me = await requireAction("myTrips");
  const next = z.enum(CHAUFFEUR_STEPS as [ReservationStatus, ...ReservationStatus[]]).parse(status);
  if (!me.driverId) return { error: "Your account isn't linked to a chauffeur record. Ask the office." };
  const [r] = await db.select().from(reservations).where(eq(reservations.id, reservationId));
  // A chauffeur can only touch trips assigned to them.
  if (!r || r.driverId !== me.driverId) return { error: "That trip isn't assigned to you." };
  if (["cancelled", "no_show", "quote"].includes(r.status))
    return { error: "This trip can't be updated. Call the office." };
  await db.update(reservations).set({ status: next, updatedAt: new Date() }).where(eq(reservations.id, reservationId));
  await db.insert(reservationEvents).values({
    reservationId,
    kind: "status",
    message: `Chauffeur set ${STATUS_LABELS[next]}`,
    actorName: me.name,
    userId: me.id,
  });
  refresh();
  return { ok: true };
}
