/**
 * Sample data for local testing.
 * Vehicle types and rates are MGL's 2026 rate card; fleet units match MGL's
 * schedule sheet. Chauffeurs, accounts and trips are made up.
 *
 *   npm run db:seed          (wipes and reseeds)
 */
import { sql } from "drizzle-orm";
import { db, schema } from "./index";
import { addDays, addMinutes, todayKey, zonedToUtc } from "../lib/time";
import type { ReservationStatus, ServiceType } from "./schema";

// Deterministic PRNG so every seed looks the same.
let s = 7;
const rand = () => (s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

async function main() {
  console.log("Clearing tables…");
  await db.execute(
    sql`TRUNCATE reservation_events, reservations, calendar_events, trip_statuses, driver_shifts, drivers, vehicles, vehicle_types, accounts RESTART IDENTITY CASCADE`,
  );
  // Continue MGL's Limo Anywhere confirmation numbers.
  await db.execute(sql`SELECT setval('reservations_conf_number_seq', 81289)`);

  const statuses = await db
    .insert(schema.tripStatuses)
    .values(
      (
        [
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
        ] as [string, string | null][]
      ).map(([name, color], i) => ({ name, color, sortOrder: i })),
    )
    .returning();
  const st = (name: string) => statuses.find((x) => x.name.startsWith(name))!;

  // MGL Limo Worldwide rate card, 2026. Base rate = SFO pickup to San Francisco.
  const types = await db
    .insert(schema.vehicleTypes)
    .values([
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
    ])
    .returning();
  const ty = (prefix: string) => types.find((t) => t.name.startsWith(prefix))!;

  const fleet: [string, string][] = [
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
  const vehicles = await db
    .insert(schema.vehicles)
    .values(fleet.map(([name, t]) => ({ name, vehicleTypeId: ty(t).id, color: "Black" })))
    .returning();
  const veh = (n: string) => vehicles.find((v) => v.name === n)!;

  const drivers = await db
    .insert(schema.drivers)
    .values([
      {
        firstName: "Marco",
        lastName: "R.",
        phone: "(415) 555-0141",
        color: "#285A97",
        defaultVehicleId: veh("MGL07").id,
      },
      {
        firstName: "Lee",
        lastName: "C.",
        phone: "(415) 555-0172",
        color: "#2D7A4C",
        defaultVehicleId: veh("MGL17").id,
      },
      {
        firstName: "Dina",
        lastName: "K.",
        phone: "(415) 555-0119",
        color: "#8F6B26",
        defaultVehicleId: veh("MGL01").id,
      },
      {
        firstName: "Tom",
        lastName: "W.",
        phone: "(415) 555-0188",
        color: "#7A4E9A",
        defaultVehicleId: veh("MGL04").id,
      },
      {
        firstName: "Ari",
        lastName: "S.",
        phone: "(415) 555-0156",
        color: "#B4532A",
        defaultVehicleId: veh("MGL15").id,
      },
      {
        firstName: "Nora",
        lastName: "V.",
        phone: "(415) 555-0133",
        color: "#1F7A7A",
        defaultVehicleId: veh("MGL02").id,
      },
    ])
    .returning();

  const accounts = await db
    .insert(schema.accounts)
    .values([
      {
        firstName: "Priya",
        lastName: "Shah",
        company: "Northwind Capital",
        phone: "(415) 555-0101",
        email: "travel@northwind.example",
        notes: "Monthly invoice",
      },
      {
        firstName: "Office",
        lastName: "Manager",
        company: "Harbor Films",
        phone: "(415) 555-0102",
        email: "office@harborfilms.example",
        notes: "Card on file",
      },
      {
        firstName: "Events",
        lastName: "Desk",
        company: "Bayline Events",
        phone: "(415) 555-0103",
        email: "events@bayline.example",
        notes: "Card on file",
      },
      {
        firstName: "J.",
        lastName: "Alvarez",
        company: "Alvarez Group",
        phone: "(415) 555-0104",
        email: "j.alvarez@example.com",
        notes: "Card on file",
      },
      {
        firstName: "K.",
        lastName: "Lin",
        company: null,
        phone: "(415) 555-0105",
        email: "klin@example.com",
        notes: "Card on file",
      },
      {
        firstName: "Dispatch",
        lastName: "Desk",
        company: "Bay Executive Cars",
        phone: "(510) 555-0106",
        email: "dispatch@bayexec.example",
        notes: "Affiliate · GNet farm-in",
      },
      {
        firstName: "Dispatch",
        lastName: "Desk",
        company: "Pacific Chauffeurs (NY)",
        phone: "(212) 555-0107",
        email: "dispatch@pacific.example",
        notes: "Affiliate · farm-out partner",
      },
      {
        firstName: "C.",
        lastName: "Méndez",
        company: null,
        phone: "(415) 555-0108",
        email: "cmendez@example.com",
        notes: "Card on file",
      },
    ])
    .returning();
  const acct = (c: string) => accounts.find((a) => (a.company ?? `${a.firstName} ${a.lastName}`).startsWith(c))!;

  const today = todayKey();

  // Shifts: everyone works most days; one day off each per week, staggered.
  const shifts: (typeof schema.driverShifts.$inferInsert)[] = [];
  for (let d = -10; d <= 30; d++) {
    const day = addDays(today, d);
    drivers.forEach((drv, i) => {
      if ((d + 70 + i) % 7 === 6) return;
      const early = i % 2 === 0;
      shifts.push({
        driverId: drv.id,
        startsAt: zonedToUtc(`${day}T${early ? "05:00" : "12:00"}`),
        endsAt: zonedToUtc(`${day}T${early ? "16:00" : "23:59"}`),
      });
    });
  }
  await db.insert(schema.driverShifts).values(shifts);

  const SFO = "SFO, San Francisco International";
  const SFO_INTL = "SFO, International Terminal";
  const hotels = [
    "Four Seasons Hotel San Francisco, 757 Market St",
    "Westin St. Francis, Union Square",
    "Hotel Zephyr, Fisherman's Wharf",
    "Ritz-Carlton, Nob Hill",
    "Palace Hotel, Market St",
    "Hyatt Regency, Embarcadero",
    "1 Market St, San Francisco",
  ];
  const venues = ["Chase Center, shuttle loop", "Moscone Center", "As directed, return to hotel", "Downtown, return"];
  const domestic = [
    "UA 1712 from ORD",
    "DL 2218 from JFK",
    "AA 2345 from LAX",
    "AS 1201 from SEA",
    "UA 590 from EWR",
    "UA 400 from IAH",
  ];
  const intl = ["BA 285 from LHR", "UA 837 from NRT", "LH 454 from FRA"];
  const people = [
    "R. Okafor",
    "M. Duarte",
    "S. Patel",
    "D. Brooks",
    "A. Romero",
    "Location scout",
    "Crew lead",
    "Event group",
  ];

  type Plan = { service: ServiceType; type: (typeof types)[number]; hours?: number; acc: (typeof accounts)[number] };
  const planFor = (): Plan => {
    const r = rand();
    if (r < 0.45)
      return {
        service: "airport_arrival",
        type: pick([ty("Executive Sedan"), ty("Cadillac"), ty("Cadillac")]),
        acc: pick(accounts.slice(0, 5)),
      };
    if (r < 0.6)
      return {
        service: "airport_departure",
        type: pick([ty("Executive Sedan"), ty("Cadillac")]),
        acc: pick(accounts.slice(0, 5)),
      };
    if (r < 0.88) {
      const type = pick([
        ty("Executive Sedan"),
        ty("Cadillac"),
        ty("Mercedes S"),
        ty("Executive Sprinter"),
        ty("Party Limo"),
        ty("Executive Bus (23"),
      ]);
      return { service: "hourly", type, hours: type.minHours + Math.floor(rand() * 3), acc: pick(accounts) };
    }
    return {
      service: "point_to_point",
      type: pick([ty("Executive Sedan"), ty("Cadillac")]),
      acc: pick(accounts.slice(0, 5)),
    };
  };

  const res: (typeof schema.reservations.$inferInsert)[] = [];
  const booked = new Map<string, [Date, Date][]>();
  for (let d = -6; d <= 26; d++) {
    const day = addDays(today, d);
    const count = d <= 3 ? 6 + Math.floor(rand() * 4) : 1 + Math.floor(rand() * 3);
    for (let n = 0; n < count; n++) {
      const p = planFor();
      const hour = 5 + Math.floor(rand() * 17);
      const minute = pick([0, 10, 15, 30, 40, 45]);
      const pickupAt = zonedToUtc(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
      const estDurationMin = p.service === "hourly" ? p.hours! * 60 : 90;
      const endAt = addMinutes(pickupAt, estDurationMin);
      const isIntl = p.service === "airport_arrival" && rand() < 0.25;

      const free = drivers.filter(
        (drv) =>
          shifts.some(
            (sh) => sh.driverId === drv.id && (sh.startsAt as Date) <= pickupAt && (sh.endsAt as Date) >= endAt,
          ) && !(booked.get(drv.id) ?? []).some(([a, b]) => a < endAt && pickupAt < b),
      );
      const wantDriver = d < 0 ? true : d === 0 ? rand() < 0.75 : rand() < Math.max(0.2, 0.85 - d * 0.07);
      const driver = wantDriver && free.length ? pick(free) : null;
      if (driver) booked.set(driver.id, [...(booked.get(driver.id) ?? []), [pickupAt, endAt]]);

      let status: ReservationStatus;
      if (d < 0) status = !driver ? "cancelled" : rand() < 0.93 ? "done" : "no_show";
      else if (d === 0)
        status = driver ? (hour < 9 ? "done" : hour < 12 ? "passenger_on_board" : "assigned") : "unassigned";
      else status = driver ? "assigned" : rand() < 0.12 ? "quote" : "unassigned";

      // MGL's colored trip status, the way dispatchers set it in Limo Anywhere.
      let trip = driver ? st("Dispatched") : st("Unassigned");
      if (status === "quote") trip = st("Pending Quote");
      else if (status === "passenger_on_board") trip = st("On the road");
      else if (status === "done") trip = pick([st("Done waiting"), st("Captured Waiver"), st("Dispatched")]);
      else if (d > 0 && rand() < 0.3)
        trip = pick([
          st("PENDING REVIEW"),
          st("Need attention"),
          st("Flight Time"),
          st("Get Status"),
          st("Waiting List"),
          st("Waiting CC"),
        ]);

      const vehicle = driver
        ? (vehicles.find((v) => v.id === driver.defaultVehicleId && v.vehicleTypeId === p.type.id) ?? null)
        : null;
      const hotel = pick(hotels);
      const base =
        p.service === "hourly"
          ? Number(p.type.hourlyRate) * Math.max(p.hours!, p.type.minHours)
          : Number(p.type.baseRate) || Number(p.type.hourlyRate) * p.type.minHours;
      const late = hour >= 21 || hour < 7 ? 30 : 0;
      const meetGreet =
        p.service === "airport_arrival" ? pick(["none", "driver", "driver", "greeter"] as const) : "none";
      const mg = meetGreet === "driver" ? 50 : meetGreet === "greeter" ? 100 : 0;

      res.push({
        accountId: p.acc.id,
        status,
        tripStatusId: trip.id,
        groupName: p.acc.company === "Northwind Capital" && rand() < 0.4 ? "Northwind roadshow" : null,
        serviceType: p.service,
        passengerName: p.acc.company ? pick(people) : `${p.acc.firstName} ${p.acc.lastName}`,
        passengerPhone: p.acc.phone,
        passengerCount: 1 + Math.floor(rand() * Math.min(p.type.capacity, 6)),
        luggageCount: p.service.startsWith("airport") ? 1 + Math.floor(rand() * 3) : 0,
        pickupAt,
        estDurationMin,
        pickupAddress: p.service === "airport_arrival" ? (isIntl ? SFO_INTL : SFO) : hotel,
        dropoffAddress:
          p.service === "airport_departure"
            ? "SFO, Terminal 2"
            : p.service === "airport_arrival"
              ? hotel
              : p.service === "hourly"
                ? pick(venues)
                : pick(hotels),
        flightNumber: p.service === "airport_arrival" ? pick(isIntl ? intl : domestic) : null,
        vehicleTypeId: p.type.id,
        vehicleId: vehicle?.id,
        driverId: driver?.id,
        baseRate: base.toFixed(2),
        gratuityPct: "0",
        extras: (late + mg).toFixed(2),
        meetGreet,
        customerNotes:
          rand() < 0.25
            ? pick(["Name sign", "Child seat needed", "2 passengers, 4 bags", "Call on arrival, do not text"])
            : null,
      });
    }
  }

  // Deliberate double-booking today so the dispatch flags are visible.
  const at = zonedToUtc(`${today}T16:00`);
  const dina = drivers[2];
  res.push(
    {
      status: "assigned",
      tripStatusId: st("Dispatched").id,
      serviceType: "hourly",
      passengerName: "R. Okafor",
      pickupAt: at,
      estDurationMin: 180,
      pickupAddress: hotels[1],
      dropoffAddress: venues[2],
      vehicleTypeId: ty("Cadillac").id,
      driverId: dina.id,
      vehicleId: veh("MGL01").id,
      baseRate: "450.00",
      gratuityPct: "0",
      accountId: acct("Northwind").id,
      groupName: "Northwind roadshow",
    },
    {
      status: "assigned",
      tripStatusId: st("Need attention").id,
      serviceType: "airport_arrival",
      passengerName: "M. Duarte",
      flightNumber: "DL 2218 from JFK",
      pickupAt: addMinutes(at, 60),
      estDurationMin: 90,
      pickupAddress: SFO,
      dropoffAddress: hotels[2],
      vehicleTypeId: ty("Cadillac").id,
      driverId: dina.id,
      vehicleId: veh("MGL01").id,
      baseRate: "186.00",
      gratuityPct: "0",
      accountId: acct("Harbor").id,
    },
  );

  res.sort((a, b) => (a.pickupAt as Date).getTime() - (b.pickupAt as Date).getTime());
  const inserted = await db.insert(schema.reservations).values(res).returning({ id: schema.reservations.id });
  await db
    .insert(schema.reservationEvents)
    .values(
      inserted.map((r) => ({ reservationId: r.id, kind: "created", message: "Reservation created (sample data)" })),
    );

  await db.insert(schema.calendarEvents).values([
    { date: today, time: "17:00", title: "Chase Center event night, expect traffic", kind: "Note" },
    { date: addDays(today, 4), time: "09:00", title: "MGL01 Escalade in for service", kind: "Vehicle" },
    { date: addDays(today, 6), time: null, title: "Lee C. day off", kind: "Driver" },
  ]);

  console.log(
    `Seeded ${statuses.length} trip statuses, ${types.length} vehicle types, ${vehicles.length} vehicles, ${drivers.length} drivers, ${accounts.length} accounts, ${shifts.length} shifts, ${inserted.length} reservations.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
