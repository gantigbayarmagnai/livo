/**
 * Sample data for local testing: a Bay Area operator's fleet, chauffeurs,
 * accounts, shifts and two weeks of trips around today's date.
 * Names, phone numbers and rates are made up.
 *
 *   npm run db:seed          (wipes and reseeds)
 */
import { db, schema } from "./index";
import { addDays, addMinutes, todayKey, zonedToUtc } from "../lib/time";
import type { ReservationStatus, ServiceType } from "./schema";
import { sql } from "drizzle-orm";

// Deterministic PRNG so every seed looks the same.
let s = 42;
const rand = () => (s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

async function main() {
  console.log("Clearing tables…");
  await db.execute(
    sql`TRUNCATE reservation_events, reservations, driver_shifts, drivers, vehicles, vehicle_types, accounts RESTART IDENTITY CASCADE`,
  );

  const types = await db
    .insert(schema.vehicleTypes)
    .values([
      { name: "Sedan", capacity: 3, baseRate: "95", hourlyRate: "85", minHours: 2, sortOrder: 1 },
      { name: "SUV", capacity: 6, baseRate: "125", hourlyRate: "110", minHours: 2, sortOrder: 2 },
      { name: "Sprinter", capacity: 14, baseRate: "225", hourlyRate: "165", minHours: 3, sortOrder: 3 },
      { name: "Stretch Limo", capacity: 10, baseRate: "260", hourlyRate: "185", minHours: 3, sortOrder: 4 },
    ])
    .returning();
  const typeBy = Object.fromEntries(types.map((t) => [t.name, t]));

  const vehicles = await db
    .insert(schema.vehicles)
    .values([
      { name: "Sedan 101", vehicleTypeId: typeBy.Sedan.id, plate: "9ABC101", color: "Black", year: 2024 },
      { name: "Sedan 102", vehicleTypeId: typeBy.Sedan.id, plate: "9ABC102", color: "Black", year: 2023 },
      { name: "SUV 201", vehicleTypeId: typeBy.SUV.id, plate: "9SUV201", color: "Black", year: 2025 },
      { name: "SUV 202", vehicleTypeId: typeBy.SUV.id, plate: "9SUV202", color: "Black", year: 2024 },
      { name: "SUV 203", vehicleTypeId: typeBy.SUV.id, plate: "9SUV203", color: "Black", year: 2022 },
      { name: "Sprinter 301", vehicleTypeId: typeBy.Sprinter.id, plate: "9SPR301", color: "Black", year: 2024 },
      { name: "Stretch 401", vehicleTypeId: typeBy["Stretch Limo"].id, plate: "9LIM401", color: "White", year: 2021 },
    ])
    .returning();

  const drivers = await db
    .insert(schema.drivers)
    .values([
      {
        firstName: "Marco",
        lastName: "Reyes",
        phone: "(925) 555-0141",
        color: "#2563eb",
        defaultVehicleId: vehicles[2].id,
      },
      {
        firstName: "Daniel",
        lastName: "Okafor",
        phone: "(925) 555-0172",
        color: "#059669",
        defaultVehicleId: vehicles[3].id,
      },
      {
        firstName: "Sasha",
        lastName: "Lindqvist",
        phone: "(510) 555-0119",
        color: "#65a30d",
        defaultVehicleId: vehicles[0].id,
      },
      {
        firstName: "Tom",
        lastName: "Haddad",
        phone: "(408) 555-0188",
        color: "#7c3aed",
        defaultVehicleId: vehicles[5].id,
      },
      {
        firstName: "Priya",
        lastName: "Nair",
        phone: "(925) 555-0156",
        color: "#db2777",
        defaultVehicleId: vehicles[1].id,
      },
      {
        firstName: "Ben",
        lastName: "Castillo",
        phone: "(510) 555-0133",
        color: "#0891b2",
        defaultVehicleId: vehicles[6].id,
      },
    ])
    .returning();

  const accounts = await db
    .insert(schema.accounts)
    .values([
      {
        firstName: "Laura",
        lastName: "Chen",
        company: "Tri-Valley Biotech",
        phone: "(925) 555-0101",
        email: "travel@trivalleybio.example",
      },
      {
        firstName: "James",
        lastName: "Whitfield",
        company: null,
        phone: "(925) 555-0102",
        email: "jwhitfield@example.com",
      },
      {
        firstName: "Monica",
        lastName: "Alvarez",
        company: "Alvarez Events",
        phone: "(510) 555-0103",
        email: "monica@alvarezevents.example",
      },
      {
        firstName: "Raj",
        lastName: "Patel",
        company: "Hacienda Law Group",
        phone: "(925) 555-0104",
        email: "rpatel@haciendalaw.example",
      },
      {
        firstName: "Emily",
        lastName: "Brooks",
        company: null,
        phone: "(408) 555-0105",
        email: "emily.brooks@example.com",
      },
      {
        firstName: "Kevin",
        lastName: "Sato",
        company: "Ruby Hill Winery Tours",
        phone: "(925) 555-0106",
        email: "kevin@rubyhilltours.example",
      },
      { firstName: "Grace", lastName: "Kim", company: null, phone: "(925) 555-0107", email: "gracek@example.com" },
      {
        firstName: "Omar",
        lastName: "Hassan",
        company: "Bishop Ranch Partners",
        phone: "(925) 555-0108",
        email: "assist@bishopranch.example",
      },
    ])
    .returning();

  const today = todayKey();

  // Shifts: everyone works most days; one day off each per week, staggered.
  const shifts: (typeof schema.driverShifts.$inferInsert)[] = [];
  for (let d = -7; d <= 14; d++) {
    const day = addDays(today, d);
    drivers.forEach((drv, i) => {
      if ((d + 70 + i) % 7 === 6) return; // day off
      const early = i % 2 === 0;
      shifts.push({
        driverId: drv.id,
        startsAt: zonedToUtc(`${day}T${early ? "04:00" : "11:00"}`),
        endsAt: zonedToUtc(`${day}T${early ? "15:00" : "23:00"}`),
      });
    });
  }
  await db.insert(schema.driverShifts).values(shifts);

  const places = {
    airports: ["SFO — San Francisco Intl", "OAK — Oakland Intl", "SJC — San Jose Intl"],
    local: [
      "5000 Hopyard Rd, Pleasanton, CA",
      "4501 Pleasanton Ave, Pleasanton, CA",
      "2600 Camino Ramon, San Ramon, CA",
      "1 Ruby Hill Dr, Pleasanton, CA",
      "3500 Hacienda Dr, Dublin, CA",
      "7000 Johnson Dr, Pleasanton, CA",
      "100 Blackhawk Plaza Cir, Danville, CA",
      "Wente Vineyards, 5050 Arroyo Rd, Livermore, CA",
    ],
    city: [
      "Chase Center, 1 Warriors Way, San Francisco, CA",
      "Fairmont Hotel, 950 Mason St, San Francisco, CA",
      "Levi's Stadium, 4900 Marie P DeBartolo Way, Santa Clara, CA",
      "Napa Valley Wine Train, 1275 McKinstry St, Napa, CA",
    ],
  };
  const airlines = ["United", "Alaska", "Southwest", "Delta", "American"];
  const passengers = [
    "Laura Chen",
    "James Whitfield",
    "Monica Alvarez",
    "Raj Patel",
    "Emily Brooks",
    "Kevin Sato",
    "Grace Kim",
    "Omar Hassan",
    "Dr. A. Mendes",
    "S. Yamamoto",
    "The Holloway party",
    "C. Duarte",
  ];

  const res: (typeof schema.reservations.$inferInsert)[] = [];
  const booked = new Map<string, [Date, Date][]>();
  for (let d = -5; d <= 10; d++) {
    const day = addDays(today, d);
    const count = 5 + Math.floor(rand() * 6);
    for (let n = 0; n < count; n++) {
      const service: ServiceType = pick([
        "airport_departure",
        "airport_departure",
        "airport_arrival",
        "airport_arrival",
        "point_to_point",
        "hourly",
        "round_trip",
      ]);
      const hour = 5 + Math.floor(rand() * 16);
      const minute = pick([0, 15, 30, 45]);
      const pickupAt = zonedToUtc(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
      const acct = rand() < 0.85 ? pick(accounts) : null;
      const type =
        service === "hourly" && rand() < 0.5
          ? pick([typeBy.Sprinter, typeBy["Stretch Limo"]])
          : pick([typeBy.Sedan, typeBy.SUV, typeBy.SUV]);
      const isAirport = service === "airport_arrival" || service === "airport_departure";
      const airport = pick(places.airports);
      const local = pick(places.local);

      const hours = service === "hourly" ? type.minHours + Math.floor(rand() * 3) : 0;
      const estDurationMin = service === "hourly" ? hours * 60 : isAirport ? 75 : pick([45, 60, 90]);
      const endAt = addMinutes(pickupAt, estDurationMin);
      // Only drivers on shift for the whole job and not already booked then.
      const free = drivers.filter(
        (drv) =>
          shifts.some(
            (sh) => sh.driverId === drv.id && (sh.startsAt as Date) <= pickupAt && (sh.endsAt as Date) >= endAt,
          ) && !(booked.get(drv.id) ?? []).some(([a, b]) => a < endAt && pickupAt < b),
      );
      const wantDriver = d < 0 ? true : d === 0 ? rand() < 0.75 : rand() < Math.max(0.15, 0.8 - d * 0.1);
      const driver = wantDriver && free.length ? pick(free) : null;
      if (driver) booked.set(driver.id, [...(booked.get(driver.id) ?? []), [pickupAt, endAt]]);

      let status: ReservationStatus;
      if (d < 0)
        status = !driver ? "cancelled" : rand() < 0.93 ? "done" : pick<ReservationStatus>(["cancelled", "no_show"]);
      else if (d === 0)
        status = driver ? (hour < 9 ? "done" : hour < 11 ? "passenger_on_board" : "assigned") : "unassigned";
      else status = driver ? "assigned" : rand() < 0.1 ? "quote" : "unassigned";
      const vehicle = driver ? (vehicles.find((v) => v.id === driver!.defaultVehicleId) ?? null) : null;
      const base =
        service === "hourly" ? Number(type.hourlyRate) * hours : Number(type.baseRate) + (isAirport ? 40 : 0);

      res.push({
        accountId: acct?.id,
        status,
        serviceType: service,
        passengerName: acct && rand() < 0.6 ? `${acct.firstName} ${acct.lastName}` : pick(passengers),
        passengerPhone: acct?.phone ?? "(925) 555-0199",
        passengerCount: 1 + Math.floor(rand() * Math.min(type.capacity, 6)),
        luggageCount: isAirport ? 1 + Math.floor(rand() * 3) : 0,
        pickupAt,
        estDurationMin,
        pickupAddress: service === "airport_arrival" ? airport : local,
        dropoffAddress:
          service === "airport_departure"
            ? airport
            : service === "hourly"
              ? pick(places.city)
              : service === "airport_arrival"
                ? local
                : pick(places.city),
        airline: isAirport ? pick(airlines) : null,
        flightNumber: isAirport ? `${100 + Math.floor(rand() * 2800)}` : null,
        vehicleTypeId: type.id,
        vehicleId: vehicle?.id,
        driverId: driver?.id,
        baseRate: base.toFixed(2),
        gratuityPct: "20",
        extras: rand() < 0.2 ? "25.00" : "0",
        customerNotes:
          rand() < 0.2
            ? pick([
                "Meet & greet with name sign",
                "Child seat needed",
                "Bottled water please",
                "Call on arrival, do not text",
              ])
            : null,
        dispatchNotes: null,
      });
    }
  }

  // Deliberate conflict today so the dispatch board's warnings are visible.
  const conflictAt = zonedToUtc(`${today}T16:00`);
  res.push(
    {
      status: "assigned",
      serviceType: "point_to_point",
      passengerName: "Conflict test A",
      pickupAt: conflictAt,
      estDurationMin: 90,
      pickupAddress: places.local[0],
      dropoffAddress: places.city[1],
      vehicleTypeId: typeBy.SUV.id,
      driverId: drivers[1].id,
      vehicleId: vehicles[3].id,
      baseRate: "125.00",
      accountId: accounts[1].id,
    },
    {
      status: "assigned",
      serviceType: "point_to_point",
      passengerName: "Conflict test B",
      pickupAt: addMinutes(conflictAt, 30),
      estDurationMin: 60,
      pickupAddress: places.local[2],
      dropoffAddress: places.local[4],
      vehicleTypeId: typeBy.SUV.id,
      driverId: drivers[1].id,
      vehicleId: vehicles[3].id,
      baseRate: "125.00",
      accountId: accounts[3].id,
    },
  );

  res.sort((a, b) => (a.pickupAt as Date).getTime() - (b.pickupAt as Date).getTime());
  const inserted = await db
    .insert(schema.reservations)
    .values(res)
    .returning({ id: schema.reservations.id, status: schema.reservations.status });
  await db
    .insert(schema.reservationEvents)
    .values(
      inserted.map((r) => ({ reservationId: r.id, kind: "created", message: "Reservation created (sample data)" })),
    );

  console.log(
    `Seeded ${types.length} vehicle types, ${vehicles.length} vehicles, ${drivers.length} drivers, ${accounts.length} accounts, ${shifts.length} shifts, ${inserted.length} reservations.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
