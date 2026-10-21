import type { ReservationStatus, ServiceType } from "@/db/schema";

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  quote: "Quote",
  unassigned: "Unassigned",
  assigned: "Assigned",
  en_route: "En route",
  on_location: "On location",
  passenger_on_board: "POB",
  done: "Done",
  cancelled: "Cancelled",
  no_show: "No show",
};

/** Order dispatchers move a trip through. */
export const STATUS_FLOW: ReservationStatus[] = [
  "quote",
  "unassigned",
  "assigned",
  "en_route",
  "on_location",
  "passenger_on_board",
  "done",
  "cancelled",
  "no_show",
];

/** Trips that still occupy a driver and vehicle. */
export const ACTIVE_STATUSES: ReservationStatus[] = [
  "unassigned",
  "assigned",
  "en_route",
  "on_location",
  "passenger_on_board",
];

export const STATUS_STYLES: Record<ReservationStatus, string> = {
  quote: "bg-violet-50 text-violet-700 ring-violet-200",
  unassigned: "bg-amber-50 text-amber-800 ring-amber-200",
  assigned: "bg-sky-50 text-sky-700 ring-sky-200",
  en_route: "bg-blue-100 text-blue-800 ring-blue-200",
  on_location: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  passenger_on_board: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  done: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
  no_show: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  point_to_point: "Point to point",
  airport_arrival: "Airport arrival",
  airport_departure: "Airport departure",
  hourly: "Hourly / as directed",
  round_trip: "Round trip",
};

export function money(v: string | number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v));
}

export function reservationTotal(r: { baseRate: string; gratuityPct: string; extras: string }): number {
  const base = Number(r.baseRate);
  return Math.round((base + (base * Number(r.gratuityPct)) / 100 + Number(r.extras)) * 100) / 100;
}

export function fullName(p: { firstName: string; lastName: string } | null | undefined): string {
  return p ? `${p.firstName} ${p.lastName}` : "";
}
