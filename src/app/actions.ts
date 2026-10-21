"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { reservationStatus, serviceType, type ReservationStatus } from "@/db/schema";
import { STATUS_LABELS, fullName } from "@/lib/labels";
import { zonedToUtc } from "@/lib/time";

const { reservations, reservationEvents, drivers, vehicles, accounts, driverShifts, vehicleTypes } = schema;

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();
const optionalId = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();
const money = z.coerce.number().min(0).max(1_000_000);

const reservationInput = z.object({
  accountId: optionalId,
  status: z.enum(reservationStatus.enumValues),
  serviceType: z.enum(serviceType.enumValues),
  passengerName: z.string().trim().min(1, "Passenger name is required"),
  passengerPhone: optionalText,
  passengerCount: z.coerce.number().int().min(1, "At least 1 passenger").max(60),
  luggageCount: z.coerce.number().int().min(0).max(60),
  pickupAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a pickup date and time"),
  estDurationMin: z.coerce
    .number()
    .int()
    .min(15)
    .max(24 * 60),
  pickupAddress: z.string().trim().min(1, "Pickup address is required"),
  dropoffAddress: optionalText,
  stops: z.string().optional(),
  airline: optionalText,
  flightNumber: optionalText,
  vehicleTypeId: optionalId,
  vehicleId: optionalId,
  driverId: optionalId,
  baseRate: money,
  gratuityPct: z.coerce.number().min(0).max(100),
  extras: money,
  customerNotes: optionalText,
  dispatchNotes: optionalText,
});

function parseReservation(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = reservationInput.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      fieldErrors[k] ??= issue.message;
    }
    return { error: { error: "Fix the highlighted fields.", fieldErrors } as FormState };
  }
  const d = parsed.data;
  // Assigning a driver to an unassigned trip moves it to Assigned, and the reverse.
  let status: ReservationStatus = d.status;
  if (d.driverId && status === "unassigned") status = "assigned";
  if (!d.driverId && status === "assigned") status = "unassigned";
  return {
    values: {
      ...d,
      status,
      pickupAt: zonedToUtc(d.pickupAt),
      stops: (d.stops ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      baseRate: d.baseRate.toFixed(2),
      gratuityPct: d.gratuityPct.toFixed(2),
      extras: d.extras.toFixed(2),
    },
  };
}

async function log(reservationId: string, kind: string, message: string) {
  await db.insert(reservationEvents).values({ reservationId, kind, message });
}

export async function createReservation(_prev: FormState, formData: FormData): Promise<FormState> {
  const p = parseReservation(formData);
  if (p.error) return p.error;
  const [row] = await db
    .insert(reservations)
    .values(p.values)
    .returning({ id: reservations.id, confNumber: reservations.confNumber });
  await log(row.id, "created", `Reservation #${row.confNumber} created`);
  redirect(`/reservations/${row.id}?created=1`);
}

export async function updateReservation(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const p = parseReservation(formData);
  if (p.error) return p.error;
  const [before] = await db.select().from(reservations).where(eq(reservations.id, id));
  if (!before) return { error: "This reservation no longer exists." };
  await db
    .update(reservations)
    .set({ ...p.values, updatedAt: new Date() })
    .where(eq(reservations.id, id));

  const changes: string[] = [];
  if (before.status !== p.values.status)
    changes.push(`status ${STATUS_LABELS[before.status]} → ${STATUS_LABELS[p.values.status]}`);
  if (before.pickupAt.getTime() !== p.values.pickupAt.getTime()) changes.push("pickup time changed");
  if (before.driverId !== p.values.driverId) changes.push("driver changed");
  if (before.vehicleId !== p.values.vehicleId) changes.push("vehicle changed");
  await log(id, "updated", changes.length ? `Edited: ${changes.join(", ")}` : "Details edited");
  refresh();
  return { ok: true };
}

/** Inline changes from the dispatch board. */
export async function setTripStatus(id: string, status: ReservationStatus) {
  const parsed = z.enum(reservationStatus.enumValues).parse(status);
  const [before] = await db.select({ status: reservations.status }).from(reservations).where(eq(reservations.id, id));
  if (!before || before.status === parsed) return;
  await db.update(reservations).set({ status: parsed, updatedAt: new Date() }).where(eq(reservations.id, id));
  await log(id, "status", `Status ${STATUS_LABELS[before.status]} → ${STATUS_LABELS[parsed]}`);
  refresh();
}

export async function assignDriver(id: string, driverId: string | null) {
  const [r] = await db.select().from(reservations).where(eq(reservations.id, id));
  if (!r) return;
  let driverName = "nobody";
  let vehicleId = r.vehicleId;
  if (driverId) {
    const [drv] = await db.select().from(drivers).where(eq(drivers.id, driverId));
    if (!drv) return;
    driverName = fullName(drv);
    // Bring the driver's usual car along if no car is set yet.
    if (!vehicleId && drv.defaultVehicleId) vehicleId = drv.defaultVehicleId;
  }
  const status: ReservationStatus =
    driverId && r.status === "unassigned" ? "assigned" : !driverId && r.status === "assigned" ? "unassigned" : r.status;
  await db
    .update(reservations)
    .set({ driverId, vehicleId, status, updatedAt: new Date() })
    .where(eq(reservations.id, id));
  await log(id, "assign", driverId ? `Assigned to ${driverName}` : "Driver removed");
  refresh();
}

export async function assignVehicle(id: string, vehicleId: string | null) {
  let name = "none";
  if (vehicleId) {
    const [v] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
    if (!v) return;
    name = v.name;
  }
  await db.update(reservations).set({ vehicleId, updatedAt: new Date() }).where(eq(reservations.id, id));
  await log(id, "assign", `Vehicle set to ${name}`);
  refresh();
}

export async function duplicateReservation(id: string) {
  const [r] = await db.select().from(reservations).where(eq(reservations.id, id));
  if (!r) return;
  const { id: _id, confNumber: _c, createdAt: _a, updatedAt: _u, ...rest } = r;
  const [row] = await db
    .insert(reservations)
    .values({ ...rest, status: "unassigned", driverId: null, vehicleId: null })
    .returning({ id: reservations.id, confNumber: reservations.confNumber });
  await log(row.id, "created", `Copied from #${r.confNumber}`);
  redirect(`/reservations/${row.id}?created=1`);
}

/* ---------- Driver schedule ---------- */

const shiftInput = z.object({
  driverId: z.string().uuid("Choose a driver"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Start time"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "End time"),
  notes: optionalText,
});

export async function addShift(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = shiftInput.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { driverId, date, start, end, notes } = parsed.data;
  const startsAt = zonedToUtc(`${date}T${start}`);
  let endsAt = zonedToUtc(`${date}T${end}`);
  // An end time before the start means the shift runs past midnight.
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3600_000);
  await db.insert(driverShifts).values({ driverId, startsAt, endsAt, notes });
  refresh();
  return { ok: true };
}

export async function deleteShift(id: string) {
  await db.delete(driverShifts).where(eq(driverShifts.id, id));
  refresh();
}

/* ---------- Resources ---------- */

export async function addAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      firstName: z.string().trim().min(1, "First name is required"),
      lastName: z.string().trim().min(1, "Last name is required"),
      company: optionalText,
      phone: optionalText,
      email: optionalText,
      notes: optionalText,
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.insert(accounts).values(parsed.data);
  refresh();
  return { ok: true };
}

export async function addDriver(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      firstName: z.string().trim().min(1, "First name is required"),
      lastName: z.string().trim().min(1, "Last name is required"),
      phone: optionalText,
      email: optionalText,
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .default("#64748b"),
      defaultVehicleId: optionalId,
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.insert(drivers).values(parsed.data);
  refresh();
  return { ok: true };
}

export async function toggleDriverStatus(id: string) {
  const [d] = await db.select().from(drivers).where(eq(drivers.id, id));
  if (!d) return;
  await db
    .update(drivers)
    .set({ status: d.status === "active" ? "inactive" : "active" })
    .where(eq(drivers.id, id));
  refresh();
}

export async function addVehicle(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Vehicle name is required"),
      vehicleTypeId: z.string().uuid("Choose a vehicle type"),
      plate: optionalText,
      color: optionalText,
      year: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(1950).max(2100).nullable()),
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.insert(vehicles).values(parsed.data);
  refresh();
  return { ok: true };
}

export async function toggleVehicleActive(id: string) {
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  if (!v) return;
  await db.update(vehicles).set({ active: !v.active }).where(eq(vehicles.id, id));
  refresh();
}

/** Rate lookup for the reservation form's "Use rate card" button. */
export async function suggestRate(vehicleTypeId: string, service: string, durationMin: number) {
  const [t] = await db.select().from(vehicleTypes).where(eq(vehicleTypes.id, vehicleTypeId));
  if (!t) return null;
  if (service === "hourly") {
    const hours = Math.max(t.minHours, Math.ceil(durationMin / 60));
    return { baseRate: (Number(t.hourlyRate) * hours).toFixed(2), note: `${hours} h × ${t.hourlyRate}/h` };
  }
  return { baseRate: Number(t.baseRate).toFixed(2), note: `${t.name} base rate` };
}
