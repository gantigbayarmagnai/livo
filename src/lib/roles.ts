import type { UserRole } from "@/db/schema";

/**
 * What each role can do. Checked on the server for every page and action;
 * the interface only hides what a role can't use.
 *
 *   ops       reservations, dispatch, calendar, accounts, shifts, trip statuses on trips
 *   money     revenue totals (e.g. "Booked today")
 *   settings  rate card, status colors, adding chauffeurs and vehicles
 *   team      user accounts
 *   myTrips   a chauffeur's own trip list
 */
export type Permission = "ops" | "money" | "settings" | "team" | "myTrips";

const GRANTS: Record<UserRole, Permission[]> = {
  owner: ["ops", "money", "settings", "team"],
  dispatcher: ["ops"],
  chauffeur: ["myTrips"],
};

export function can(role: UserRole | null | undefined, p: Permission): boolean {
  return !!role && GRANTS[role].includes(p);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  dispatcher: "Dispatcher",
  chauffeur: "Chauffeur",
};

export const ROLE_HELP: Record<UserRole, string> = {
  owner: "Everything, including team, rates, statuses and revenue.",
  dispatcher: "Reservations, dispatch, calendar, accounts and schedules. No settings or revenue totals.",
  chauffeur: "Only their own trips, on their phone, with status buttons.",
};

/** Where each role lands after signing in. */
export function homeFor(role: UserRole): string {
  return role === "chauffeur" ? "/my-trips" : "/dispatch";
}
