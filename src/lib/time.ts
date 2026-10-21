/**
 * Time helpers. Every pickup is entered and displayed in the company's
 * time zone, regardless of where the server or the dispatcher's browser is.
 */

export const COMPANY_TZ = process.env.NEXT_PUBLIC_COMPANY_TZ || "America/Los_Angeles";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsInZone(date: Date, tz = COMPANY_TZ): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const { type, value } of fmt.formatToParts(date)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

/** Offset (ms) of the zone from UTC at a given instant. */
function zoneOffsetMs(date: Date, tz = COMPANY_TZ): number {
  const p = partsInZone(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-21T14:30" in company time → UTC Date. Handles DST transitions. */
export function zonedToUtc(local: string, tz = COMPANY_TZ): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(local);
  if (!m) throw new Error(`Invalid local datetime: ${local}`);
  const [, y, mo, d, h = "00", mi = "00"] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi);
  let utc = guess - zoneOffsetMs(new Date(guess), tz);
  // Second pass corrects for instants that straddle a DST change.
  utc = guess - zoneOffsetMs(new Date(utc), tz);
  return new Date(utc);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC Date → "YYYY-MM-DD" in company time. */
export function toDateKey(date: Date, tz = COMPANY_TZ): string {
  const p = partsInZone(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** UTC Date → value for an <input type="datetime-local"> in company time. */
export function toLocalInput(date: Date, tz = COMPANY_TZ): string {
  const p = partsInZone(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Start and end (exclusive) of a company-time calendar day, as UTC instants. */
export function dayRange(dateKey: string): { start: Date; end: Date } {
  return { start: zonedToUtc(dateKey), end: zonedToUtc(addDays(dateKey, 1)) };
}

/** Pure calendar arithmetic on "YYYY-MM-DD" keys (no time zone involved). */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday for a date key. */
export function weekday(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday of the week containing dateKey. */
export function startOfWeek(dateKey: string): string {
  const wd = weekday(dateKey);
  return addDays(dateKey, wd === 0 ? -6 : 1 - wd);
}

export function isDateKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function formatTime(date: Date, tz = COMPANY_TZ): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatDate(date: Date, tz = COMPANY_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date, tz = COMPANY_TZ): string {
  return `${formatDate(date, tz)} · ${formatTime(date, tz)}`;
}

/** Long label for a date key, e.g. "Wednesday, Oct 21". */
export function formatDayKey(
  dateKey: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" },
): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function addMinutes(date: Date, min: number): Date {
  return new Date(date.getTime() + min * 60_000);
}
