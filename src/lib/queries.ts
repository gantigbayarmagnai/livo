import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ReservationStatus } from "@/db/schema";
import { ACTIVE_STATUSES } from "./labels";
import { addMinutes, dayRange, toDateKey } from "./time";

const { reservations, accounts, drivers, vehicles, vehicleTypes, driverShifts, reservationEvents } = schema;

export type ReservationRow = Awaited<ReturnType<typeof listReservations>>[number];

/** Reservation list with the joined names every screen needs. */
export async function listReservations(opts: {
  from?: Date;
  to?: Date;
  statuses?: ReservationStatus[];
  search?: string;
  driverId?: string;
  limit?: number;
}) {
  const where: SQL[] = [];
  if (opts.from) where.push(gte(reservations.pickupAt, opts.from));
  if (opts.to) where.push(lt(reservations.pickupAt, opts.to));
  if (opts.statuses?.length) where.push(inArray(reservations.status, opts.statuses));
  if (opts.driverId) where.push(eq(reservations.driverId, opts.driverId));
  if (opts.search) {
    const q = `%${opts.search}%`;
    const num = Number(opts.search.replace(/^#/, ""));
    const ors: SQL[] = [
      ilike(reservations.passengerName, q),
      ilike(reservations.pickupAddress, q),
      ilike(reservations.dropoffAddress, q),
      ilike(accounts.company, q),
      ilike(accounts.lastName, q),
      ilike(reservations.flightNumber, q),
    ];
    if (Number.isInteger(num) && num > 0) ors.push(eq(reservations.confNumber, num));
    where.push(or(...ors)!);
  }

  return db
    .select({
      r: reservations,
      account: {
        id: accounts.id,
        firstName: accounts.firstName,
        lastName: accounts.lastName,
        company: accounts.company,
      },
      driver: { id: drivers.id, firstName: drivers.firstName, lastName: drivers.lastName, color: drivers.color },
      vehicle: { id: vehicles.id, name: vehicles.name },
      vehicleType: { id: vehicleTypes.id, name: vehicleTypes.name },
    })
    .from(reservations)
    .leftJoin(accounts, eq(reservations.accountId, accounts.id))
    .leftJoin(drivers, eq(reservations.driverId, drivers.id))
    .leftJoin(vehicles, eq(reservations.vehicleId, vehicles.id))
    .leftJoin(vehicleTypes, eq(reservations.vehicleTypeId, vehicleTypes.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(reservations.pickupAt))
    .limit(opts.limit ?? 500);
}

export async function getReservation(id: string) {
  const [row] = await db
    .select({ r: reservations, account: accounts })
    .from(reservations)
    .leftJoin(accounts, eq(reservations.accountId, accounts.id))
    .where(eq(reservations.id, id));
  if (!row) return null;
  const events = await db
    .select()
    .from(reservationEvents)
    .where(eq(reservationEvents.reservationId, id))
    .orderBy(desc(reservationEvents.createdAt));
  return { ...row, events };
}

/** Lookup lists for forms and dispatch selects. */
export async function getResources() {
  const [acctRows, driverRows, vehicleRows, typeRows] = await Promise.all([
    db.select().from(accounts).orderBy(asc(accounts.lastName)),
    db.select().from(drivers).orderBy(asc(drivers.firstName)),
    db
      .select({ v: vehicles, typeName: vehicleTypes.name })
      .from(vehicles)
      .innerJoin(vehicleTypes, eq(vehicles.vehicleTypeId, vehicleTypes.id))
      .orderBy(asc(vehicleTypes.sortOrder), asc(vehicles.name)),
    db.select().from(vehicleTypes).orderBy(asc(vehicleTypes.sortOrder)),
  ]);
  return {
    accounts: acctRows,
    drivers: driverRows,
    vehicles: vehicleRows.map((x) => ({ ...x.v, typeName: x.typeName })),
    vehicleTypes: typeRows,
  };
}
export type Resources = Awaited<ReturnType<typeof getResources>>;

export async function listShifts(from: Date, to: Date) {
  return db
    .select()
    .from(driverShifts)
    .where(and(lt(driverShifts.startsAt, to), gte(driverShifts.endsAt, from)))
    .orderBy(asc(driverShifts.startsAt));
}

export type Warning = { kind: "overlap" | "off_shift" | "capacity" | "vehicle_overlap"; message: string };

/**
 * Dispatch checks for a day's trips: driver double-booked, vehicle
 * double-booked, driver assigned outside their shift, too many passengers
 * for the vehicle type.
 */
export function computeWarnings(
  rows: ReservationRow[],
  shifts: { driverId: string; startsAt: Date; endsAt: Date }[],
  types: { id: string; capacity: number }[],
): Map<string, Warning[]> {
  const out = new Map<string, Warning[]>();
  const add = (id: string, w: Warning) => out.set(id, [...(out.get(id) ?? []), w]);
  const active = rows.filter((x) => ACTIVE_STATUSES.includes(x.r.status));

  const overlaps = (a: ReservationRow, b: ReservationRow) =>
    a.r.pickupAt < addMinutes(b.r.pickupAt, b.r.estDurationMin) &&
    b.r.pickupAt < addMinutes(a.r.pickupAt, a.r.estDurationMin);

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i],
        b = active[j];
      if (!overlaps(a, b)) continue;
      if (a.r.driverId && a.r.driverId === b.r.driverId) {
        add(a.r.id, { kind: "overlap", message: `Driver also on #${b.r.confNumber}` });
        add(b.r.id, { kind: "overlap", message: `Driver also on #${a.r.confNumber}` });
      }
      if (a.r.vehicleId && a.r.vehicleId === b.r.vehicleId) {
        add(a.r.id, { kind: "vehicle_overlap", message: `Vehicle also on #${b.r.confNumber}` });
        add(b.r.id, { kind: "vehicle_overlap", message: `Vehicle also on #${a.r.confNumber}` });
      }
    }
  }

  for (const x of active) {
    if (x.r.driverId) {
      const end = addMinutes(x.r.pickupAt, x.r.estDurationMin);
      const covered = shifts.some((s) => s.driverId === x.r.driverId && s.startsAt <= x.r.pickupAt && s.endsAt >= end);
      if (!covered) add(x.r.id, { kind: "off_shift", message: "Outside driver's shift" });
    }
    const t = types.find((t) => t.id === x.r.vehicleTypeId);
    if (t && x.r.passengerCount > t.capacity) {
      add(x.r.id, { kind: "capacity", message: `${x.r.passengerCount} pax > ${t.capacity} seats` });
    }
  }
  return out;
}

/** Per-day trip counts for the calendar, keyed by company-time date. */
export async function countsByDay(from: Date, to: Date) {
  const rows = await db
    .select({ pickupAt: reservations.pickupAt, status: reservations.status, driverId: reservations.driverId })
    .from(reservations)
    .where(and(gte(reservations.pickupAt, from), lt(reservations.pickupAt, to)));
  const map = new Map<string, { total: number; unassigned: number; cancelled: number }>();
  for (const r of rows) {
    const k = toDateKey(r.pickupAt);
    const c = map.get(k) ?? { total: 0, unassigned: 0, cancelled: 0 };
    if (r.status === "cancelled" || r.status === "no_show") c.cancelled++;
    else {
      c.total++;
      if (!r.driverId && r.status !== "quote" && r.status !== "done") c.unassigned++;
    }
    map.set(k, c);
  }
  return map;
}

export async function dayTrips(dateKey: string) {
  const { start, end } = dayRange(dateKey);
  return listReservations({ from: start, to: end });
}

export async function accountsWithCounts() {
  return db
    .select({
      a: accounts,
      trips: sql<number>`count(${reservations.id})::int`,
      last: sql<Date | null>`max(${reservations.pickupAt})`,
    })
    .from(accounts)
    .leftJoin(reservations, eq(reservations.accountId, accounts.id))
    .groupBy(accounts.id)
    .orderBy(asc(accounts.lastName));
}
