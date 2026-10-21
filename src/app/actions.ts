"use server";

import { eq, ilike } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { reservationStatus, serviceType, type ReservationStatus } from "@/db/schema";
import { STATUS_LABELS, fullName } from "@/lib/labels";
import { quote, type MeetGreet } from "@/lib/pricing";
import { zonedToUtc } from "@/lib/time";

const {
  reservations,
  reservationEvents,
  drivers,
  vehicles,
  accounts,
  driverShifts,
  vehicleTypes,
  tripStatuses,
  calendarEvents,
} = schema;

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
const money = z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0).max(1_000_000));

const reservationInput = z.object({
  accountId: optionalId,
  status: z.enum(reservationStatus.enumValues),
  tripStatusId: optionalId,
  groupName: optionalText,
  serviceType: z.enum(serviceType.enumValues),
  passengerName: z.string().trim().min(1, "Add the passenger"),
  passengerPhone: optionalText,
  passengerCount: z.coerce.number().int().min(1, "At least 1 passenger").max(60),
  luggageCount: z.coerce.number().int().min(0).max(60),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Add the pickup date"),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/, "Add the pickup time"),
  hours: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0).max(24)),
  estDurationMin: z.preprocess(
    (v) => (v === "" || v == null ? 90 : v),
    z.coerce
      .number()
      .int()
      .min(15)
      .max(24 * 60),
  ),
  outsideSf: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  meetGreet: z.enum(["none", "driver", "greeter"]).default("none"),
  pickupAddress: z.string().trim().min(1, "Add the pickup"),
  dropoffAddress: optionalText,
  stops: z.string().optional(),
  flightNumber: optionalText,
  vehicleTypeId: optionalId,
  vehicleId: optionalId,
  driverId: optionalId,
  staffPrice: money,
  tolls: money,
  customerNotes: optionalText,
  dispatchNotes: optionalText,
});

async function parseReservation(formData: FormData) {
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
  const [type] = d.vehicleTypeId
    ? await db.select().from(vehicleTypes).where(eq(vehicleTypes.id, d.vehicleTypeId))
    : [];
  // Price on the server from the rate card, the same way the form previews it.
  const q = quote({
    service: d.serviceType,
    type: type ?? null,
    hours: d.hours,
    outsideSf: d.outsideSf,
    meetGreet: d.meetGreet as MeetGreet,
    pickupTime: d.pickupTime,
    staffPrice: d.staffPrice,
    tolls: d.tolls,
  });
  const estDurationMin = d.serviceType === "hourly" ? Math.max(d.hours, q.minHours ?? 0, 1) * 60 : d.estDurationMin;

  // Assigning a driver to an unassigned trip moves it to Assigned, and the reverse.
  let status: ReservationStatus = d.status;
  if (d.driverId && status === "unassigned") status = "assigned";
  if (!d.driverId && status === "assigned") status = "unassigned";

  // No trip status chosen: Unassigned or Dispatched, as Limo Anywhere does.
  let tripStatusId = d.tripStatusId ?? null;
  if (!tripStatusId) {
    const [auto] = await db
      .select()
      .from(tripStatuses)
      .where(ilike(tripStatuses.name, d.driverId ? "dispatched" : "unassigned"));
    tripStatusId = auto?.id ?? null;
  }

  const { pickupDate, pickupTime, hours: _h, staffPrice: _s, tolls: _t, ...rest } = d;
  return {
    values: {
      ...rest,
      tripStatusId,
      status,
      estDurationMin,
      pickupAt: zonedToUtc(`${pickupDate}T${pickupTime}`),
      meetGreet: d.serviceType === "airport_arrival" ? d.meetGreet : "none",
      stops: (d.stops ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      baseRate: q.base.toFixed(2),
      gratuityPct: "0",
      extras: q.addOns.toFixed(2),
    },
  };
}

async function log(reservationId: string, kind: string, message: string) {
  await db.insert(reservationEvents).values({ reservationId, kind, message });
}

export async function createReservation(_prev: FormState, formData: FormData): Promise<FormState> {
  const p = await parseReservation(formData);
  if (p.error) return p.error;
  const [row] = await db
    .insert(reservations)
    .values(p.values)
    .returning({ id: reservations.id, confNumber: reservations.confNumber });
  await log(row.id, "created", `Reservation #${row.confNumber} created`);
  redirect(`/reservations/${row.id}?created=1`);
}

export async function updateReservation(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const p = await parseReservation(formData);
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
  if (before.tripStatusId !== p.values.tripStatusId) changes.push("trip status changed");
  if (before.pickupAt.getTime() !== p.values.pickupAt.getTime()) changes.push("pickup time changed");
  if (before.driverId !== p.values.driverId) changes.push("driver changed");
  if (before.vehicleId !== p.values.vehicleId) changes.push("vehicle changed");
  if (before.baseRate !== p.values.baseRate || before.extras !== p.values.extras) changes.push("price changed");
  await log(id, "updated", changes.length ? `Edited: ${changes.join(", ")}` : "Details edited");
  refresh();
  return { ok: true };
}

/** Inline changes from the dispatch board. */
export async function setStatus(id: string, status: ReservationStatus) {
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
  // Keep MGL's trip status in step: Unassigned ↔ Dispatched.
  let tripStatusId = r.tripStatusId;
  const [unassignedSt] = await db.select().from(tripStatuses).where(ilike(tripStatuses.name, "unassigned"));
  const [dispatchedSt] = await db.select().from(tripStatuses).where(ilike(tripStatuses.name, "dispatched"));
  if (driverId && unassignedSt && dispatchedSt && (!tripStatusId || tripStatusId === unassignedSt.id))
    tripStatusId = dispatchedSt.id;
  if (!driverId && unassignedSt && dispatchedSt && tripStatusId === dispatchedSt.id) tripStatusId = unassignedSt.id;
  await db
    .update(reservations)
    .set({ driverId, vehicleId, status, tripStatusId, updatedAt: new Date() })
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

/* ---------- Trip statuses (MGL's colored statuses) ---------- */

export async function setTripStatus(id: string, tripStatusId: string) {
  const [stRow] = await db.select().from(tripStatuses).where(eq(tripStatuses.id, tripStatusId));
  if (!stRow) return;
  await db.update(reservations).set({ tripStatusId, updatedAt: new Date() }).where(eq(reservations.id, id));
  await log(id, "trip_status", `Trip status set to ${stRow.name}`);
  refresh();
}

export async function setTripStatusColor(id: string, color: string | null) {
  const c =
    color === null
      ? null
      : z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .parse(color);
  await db.update(tripStatuses).set({ color: c }).where(eq(tripStatuses.id, id));
  refresh();
}

export async function addTripStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ name: z.string().trim().min(1, "Name the status"), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const existing = await db.select({ id: tripStatuses.id }).from(tripStatuses);
  await db.insert(tripStatuses).values({ ...parsed.data, sortOrder: existing.length });
  refresh();
  return { ok: true };
}

/* ---------- Calendar events ---------- */

export async function addCalendarEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      title: z.string().trim().min(1, "Give the event a name"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
      time: z
        .string()
        .transform((v) => (v === "" ? null : v))
        .nullable()
        .refine((v) => v === null || /^\d{2}:\d{2}$/.test(v), "Pick a time"),
      kind: z.enum(["Note", "Vehicle", "Driver"]).default("Note"),
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.insert(calendarEvents).values(parsed.data);
  refresh();
  return { ok: true };
}

export async function deleteCalendarEvent(id: string) {
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  refresh();
}

/* ---------- Rate lookup ---------- */

export async function getRateCard() {
  return db.select().from(vehicleTypes).orderBy(vehicleTypes.sortOrder);
}

/** Pickup move after a flight delay (dispatch detail). */
export async function movePickup(id: string, date: string, time: string) {
  z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .parse(date);
  z.string()
    .regex(/^\d{2}:\d{2}$/)
    .parse(time);
  await db
    .update(reservations)
    .set({ pickupAt: zonedToUtc(`${date}T${time}`), updatedAt: new Date() })
    .where(eq(reservations.id, id));
  await log(id, "updated", `Pickup moved to ${time}`);
  refresh();
}
