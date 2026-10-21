/**
 * MGL Limo Worldwide's starting configuration: 2026 rate card, the trip
 * statuses MGL uses in Limo Anywhere, and fleet unit numbers. Used by the
 * first-run setup (optional) and by the sample-data seed.
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export const MGL_TRIP_STATUSES: [string, string | null][] = [
  ["Unassigned", "#D33A2C"],
  ["On the road", "#3BAA5C"],
  ["Done waiting for return booking.", "#6E6E6E"],
  ["Waiting CC verification to sign link sent", null],
  ["PENDING REVIEW & AVAILABILITY", "#AFC0EA"],
  ["Need attention.", "#C495AA"],
  ["Pending Quote", "#95C2EF"],
  ["Dispatched", null],
  ["Flight Time, Date Change", "#F1BFB9"],
  ["Get Status Now!", "#D63AD6"],
  ["Waiting List", null],
  ["Captured Waiver", "#2E7D32"],
];

/** Base rate = SFO pickup to San Francisco. "0" means not on the rate card. */
export const MGL_VEHICLE_TYPES = [
  { name: "Executive Sedan", capacity: 3, baseRate: "156", hourlyRate: "120", minHours: 3, sortOrder: 1 },
  { name: "Mercedes S-Class", capacity: 3, baseRate: "0", hourlyRate: "150", minHours: 3, sortOrder: 2 },
  { name: "Cadillac Escalade SUV", capacity: 6, baseRate: "186", hourlyRate: "150", minHours: 3, sortOrder: 3 },
  { name: "Executive Sprinter", capacity: 14, baseRate: "481", hourlyRate: "180", minHours: 6, sortOrder: 4 },
  { name: "Party Limo Sprinter", capacity: 12, baseRate: "0", hourlyRate: "210", minHours: 6, sortOrder: 5 },
  { name: "Jet Sprinter", capacity: 8, baseRate: "0", hourlyRate: "225", minHours: 6, sortOrder: 6 },
  { name: "Mini Coach", capacity: 28, baseRate: "1026", hourlyRate: "0", minHours: 6, sortOrder: 7 },
  { name: "Executive Bus (23 pax)", capacity: 23, baseRate: "0", hourlyRate: "255", minHours: 6, sortOrder: 8 },
  { name: "Executive Bus (37 pax)", capacity: 37, baseRate: "0", hourlyRate: "295", minHours: 6, sortOrder: 9 },
  { name: "Motor Coach (50 pax)", capacity: 50, baseRate: "0", hourlyRate: "315", minHours: 6, sortOrder: 10 },
];

/** Unit number → vehicle type name prefix. */
export const MGL_FLEET: [string, string][] = [
  ["MGL01", "Cadillac Escalade"],
  ["MGL04", "Cadillac Escalade"],
  ["MGL16", "Cadillac Escalade"],
  ["MGLVIP", "Cadillac Escalade"],
  ["MGL21", "Cadillac Escalade"],
  ["MGL02", "Mercedes S"],
  ["MGL03", "Mercedes S"],
  ["MGL05", "Mercedes S"],
  ["MGL09", "Mercedes S"],
  ["MGL07", "Executive Sedan"],
  ["MGL17", "Executive Sedan"],
  ["MGL12", "Executive Sprinter"],
  ["MGL15", "Executive Sprinter"],
  ["MGL19", "Executive Sprinter"],
  ["MGL20", "Executive Sprinter"],
  ["MGL14", "Party Limo"],
  ["MGL18", "Party Limo"],
  ["MGL10", "Jet Sprinter"],
];

type Db = NodePgDatabase<typeof schema>;

/** Insert MGL's starting configuration. Only fills tables that are still empty. */
export async function insertMglDefaults(db: Db) {
  const haveStatuses = (await db.select({ id: schema.tripStatuses.id }).from(schema.tripStatuses).limit(1)).length > 0;
  const haveTypes = (await db.select({ id: schema.vehicleTypes.id }).from(schema.vehicleTypes).limit(1)).length > 0;

  const statuses = haveStatuses
    ? []
    : await db
        .insert(schema.tripStatuses)
        .values(MGL_TRIP_STATUSES.map(([name, color], i) => ({ name, color, sortOrder: i })))
        .returning();

  let types: (typeof schema.vehicleTypes.$inferSelect)[] = [];
  let vehicles: (typeof schema.vehicles.$inferSelect)[] = [];
  if (!haveTypes) {
    types = await db.insert(schema.vehicleTypes).values(MGL_VEHICLE_TYPES).returning();
    const ty = (prefix: string) => types.find((t) => t.name.startsWith(prefix))!;
    vehicles = await db
      .insert(schema.vehicles)
      .values(MGL_FLEET.map(([name, t]) => ({ name, vehicleTypeId: ty(t).id, color: "Black" })))
      .returning();
  }
  return { statuses, types, vehicles };
}
