/**
 * MGL Limo Worldwide pricing rules (2026 rate card), as used in the prototype.
 * Pure functions so the booking form, rate lookup and server agree.
 *
 * - Airport arrival = SFO pickup to San Francisco, flat transfer rate (vehicle type's base rate).
 * - Hourly: hourly rate × hours, with a minimum. Small vehicles (≤ 6 seats):
 *   3 hours in San Francisco, 6 elsewhere. Larger vehicles: 6 hours.
 * - Meet & Greet: driver at bag claim +$50, separate greeter +$100.
 * - Late/early pickup (9 PM to 7 AM): +$30.
 * - Anything else needs a staff price.
 * Rates are all-inclusive with gratuity; tolls and parking are billed separately.
 */

export type MeetGreet = "none" | "driver" | "greeter";
export const MEET_GREET: Record<MeetGreet, { label: string; price: number }> = {
  none: { label: "Curbside (included)", price: 0 },
  driver: { label: "Driver Meet & Greet at bag claim", price: 50 },
  greeter: { label: "Separate greeter to curbside", price: 100 },
};

export type RateType = {
  name: string;
  capacity: number;
  baseRate: string | number;
  hourlyRate: string | number;
  minHours: number;
};

export type QuoteInput = {
  service: string;
  type: RateType | null;
  hours: number;
  outsideSf: boolean;
  meetGreet: MeetGreet;
  pickupTime: string; // "HH:MM"
  staffPrice: number; // used when the trip isn't on the rate card (or to override)
  tolls: number;
};

export type Quote = {
  lines: [string, number][];
  base: number; // rate card or staff price
  addOns: number; // meet & greet + late/early + tolls
  total: number;
  staff: string | null; // reason a staff price is needed
  minHours: number | null;
  notes: string[];
};

const money0 = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function minHoursFor(type: RateType, outsideSf: boolean) {
  return type.capacity <= 6 ? (outsideSf ? 6 : 3) : Math.max(type.minHours, 6);
}

export function quote(q: QuoteInput): Quote {
  const lines: [string, number][] = [];
  const notes: string[] = [];
  let staff: string | null = null;
  let base = 0;
  let minHours: number | null = null;
  const t = q.type;
  const transfer = t ? Number(t.baseRate) : 0;
  const hourly = t ? Number(t.hourlyRate) : 0;

  if (!t) staff = "Choose a vehicle type.";
  else if (q.service === "airport_arrival") {
    if (transfer > 0) {
      base = transfer;
      lines.push([`SFO to San Francisco, ${t.name}`, transfer]);
    } else staff = `${t.name} has no SFO transfer rate on the rate card.`;
  } else if (q.service === "hourly") {
    if (hourly > 0) {
      minHours = minHoursFor(t, q.outsideSf);
      const hrs = Math.max(q.hours || 0, minHours);
      base = hrs * hourly;
      lines.push([
        `${t.name}, ${hrs} hrs × ${money0(hourly)}${hrs > (q.hours || 0) ? ` (${minHours}-hr minimum)` : ""}`,
        base,
      ]);
      notes.push("$600 security deposit pre-authorized, refunded after the trip.");
      notes.push(`Includes 200 miles per day; extra miles $${t.capacity <= 3 ? 2 : 3}/mile.`);
    } else staff = `${t.name} has no hourly rate on the rate card.`;
  } else staff = "This route isn't on the rate card. Enter a staff price.";

  // A staff price fills in for (or overrides) the rate card.
  if (q.staffPrice > 0) {
    base = q.staffPrice;
    lines.length = 0;
    lines.push([`${t?.name ?? "Vehicle"}, staff price`, q.staffPrice]);
    staff = null;
  }

  let addOns = 0;
  if (q.service === "airport_arrival") {
    const mg = MEET_GREET[q.meetGreet] ?? MEET_GREET.none;
    if (mg.price) {
      lines.push([mg.label, mg.price]);
      addOns += mg.price;
    }
  }
  const h = Number((q.pickupTime || "12:00").split(":")[0]);
  if (h >= 21 || h < 7) {
    lines.push(["Late/early pickup (9 PM to 7 AM)", 30]);
    addOns += 30;
  }
  if (q.tolls > 0) {
    lines.push(["Tolls and parking", q.tolls]);
    addOns += q.tolls;
  }

  notes.push("All-inclusive, gratuity included. Tolls and parking billed separately.");
  if (t) {
    notes.push(
      t.capacity > 6
        ? "Cancellation: 1 week notice for a full refund. Large vehicles can't be downgraded."
        : "Cancellation: 12 hours notice, or the full amount is charged.",
    );
  }
  return { lines, base, addOns, total: staff ? 0 : base + addOns, staff, minHours, notes };
}
