import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

/**
 * Livo core data model.
 *
 * Mirrors the sections a Limo Anywhere operator already knows
 * (Customers/Accounts, Reservations, Dispatch, Drivers, Vehicles)
 * so migration and onboarding stay familiar.
 */

export const reservationStatus = pgEnum("reservation_status", [
  "quote",
  "unassigned",
  "assigned",
  "en_route",
  "on_location",
  "passenger_on_board",
  "done",
  "cancelled",
  "no_show",
]);

export const serviceType = pgEnum("service_type", [
  "point_to_point",
  "airport_arrival",
  "airport_departure",
  "hourly",
  "round_trip",
]);

export const driverStatus = pgEnum("driver_status", ["active", "inactive"]);

/** owner: everything · dispatcher: day-to-day operations · chauffeur: their own trips. */
export const userRole = pgEnum("user_role", ["owner", "dispatcher", "chauffeur"]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountNumber: serial("account_number").notNull().unique(),
  company: text("company"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const vehicleTypes = pgTable("vehicle_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  baseRate: numeric("base_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  minHours: integer("min_hours").notNull().default(2),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  vehicleTypeId: uuid("vehicle_type_id")
    .notNull()
    .references(() => vehicleTypes.id),
  plate: text("plate"),
  color: text("color"),
  year: integer("year"),
  active: boolean("active").notNull().default(true),
});

export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  status: driverStatus("status").notNull().default("active"),
  /** Hex color used on the dispatch board and schedule. */
  color: text("color").notNull().default("#64748b"),
  defaultVehicleId: uuid("default_vehicle_id").references(() => vehicles.id),
});

export const driverShifts = pgTable(
  "driver_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
  },
  (t) => [index("driver_shifts_driver_starts_idx").on(t.driverId, t.startsAt)],
);

/**
 * The operator's own colored trip statuses, as in Limo Anywhere
 * ("On the road", "Pending Quote", "Get Status Now!"…). They color the
 * calendar. A null color means "no color".
 */
export const tripStatuses = pgTable("trip_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** Non-reservation calendar entries: vehicle service, days off, notes. */
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: text("date").notNull(), // company-time "YYYY-MM-DD"
    time: text("time"), // "HH:MM", null = all day
    title: text("title").notNull(),
    kind: text("kind").notNull().default("Note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("calendar_events_date_idx").on(t.date)],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-facing confirmation number, like LA's Conf #. */
    confNumber: serial("conf_number").notNull().unique(),
    accountId: uuid("account_id").references(() => accounts.id),
    status: reservationStatus("status").notNull().default("unassigned"),
    serviceType: serviceType("service_type").notNull().default("point_to_point"),

    passengerName: text("passenger_name").notNull(),
    passengerPhone: text("passenger_phone"),
    passengerCount: integer("passenger_count").notNull().default(1),
    luggageCount: integer("luggage_count").notNull().default(0),

    pickupAt: timestamp("pickup_at", { withTimezone: true }).notNull(),
    /** Estimated job length; drives conflict checks on the dispatch board. */
    estDurationMin: integer("est_duration_min").notNull().default(60),
    pickupAddress: text("pickup_address").notNull(),
    dropoffAddress: text("dropoff_address"),
    stops: jsonb("stops").$type<string[]>().notNull().default([]),

    airline: text("airline"),
    /** none | driver | greeter (airport arrivals). */
    meetGreet: text("meet_greet").notNull().default("none"),
    /** Hourly jobs outside San Francisco carry a longer minimum. */
    outsideSf: boolean("outside_sf").notNull().default(false),
    flightNumber: text("flight_number"),

    tripStatusId: uuid("trip_status_id").references(() => tripStatuses.id, { onDelete: "set null" }),
    /** Optional grouping, e.g. a roadshow or wedding with several trips. */
    groupName: text("group_name"),

    vehicleTypeId: uuid("vehicle_type_id").references(() => vehicleTypes.id),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id),
    driverId: uuid("driver_id").references(() => drivers.id),

    baseRate: numeric("base_rate", { precision: 10, scale: 2 }).notNull().default("0"),
    gratuityPct: numeric("gratuity_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    extras: numeric("extras", { precision: 10, scale: 2 }).notNull().default("0"),

    customerNotes: text("customer_notes"),
    dispatchNotes: text("dispatch_notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("reservations_pickup_idx").on(t.pickupAt),
    index("reservations_driver_pickup_idx").on(t.driverId, t.pickupAt),
  ],
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // stored lowercase
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  /** For chauffeurs: which driver record is theirs. */
  driverId: uuid("driver_id").references(() => drivers.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  /** Set when an owner creates or resets the password; cleared once the user picks their own. */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Signed-in sessions. The id is a SHA-256 of the cookie token, so a database leak can't be replayed. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Audit trail: every status change, assignment, and edit. */
export const reservationEvents = pgTable(
  "reservation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    /** Who made the change (kept as text so history survives a deleted user). */
    actorName: text("actor_name"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("reservation_events_res_idx").on(t.reservationId, t.createdAt)],
);

export type Account = typeof accounts.$inferSelect;
export type VehicleType = typeof vehicleTypes.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type DriverShift = typeof driverShifts.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type TripStatus = typeof tripStatuses.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type ReservationEvent = typeof reservationEvents.$inferSelect;
export type ReservationStatus = (typeof reservationStatus.enumValues)[number];
export type ServiceType = (typeof serviceType.enumValues)[number];
