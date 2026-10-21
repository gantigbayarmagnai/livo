import type { Metadata } from "next";
import { requirePage } from "@/lib/auth";
import { Suspense } from "react";
import { CalendarView, type CalTrip, type CalView } from "@/components/calendar";
import { Loading, ViewHead } from "@/components/ui";
import { fullName, reservationTotal } from "@/lib/labels";
import { getResources, listCalendarEvents, listReservations, listTripStatuses } from "@/lib/queries";
import { addDays, hhmm, isDateKey, toDateKey, todayKey, weekday, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <Suspense
      fallback={
        <>
          <ViewHead eyebrow="Calendar" title="Reservations and events" />
          <Loading rows={8} />
        </>
      }
    >
      <CalendarData searchParams={searchParams as Promise<{ view?: string; date?: string }>} />
    </Suspense>
  );
}

/** First and last visible day for a view, as company-time date keys. Weeks start on Sunday. */
function visibleRange(view: CalView, date: string): [string, string] {
  if (view === "day") return [date, date];
  if (view === "week") {
    const start = addDays(date, -weekday(date));
    return [start, addDays(start, 6)];
  }
  const first = `${date.slice(0, 7)}-01`;
  const start = addDays(first, -weekday(first));
  return [start, addDays(start, 41)];
}

async function CalendarData({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  await requirePage("ops");
  const sp = await searchParams;
  const today = todayKey();
  const view: CalView = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const date = isDateKey(sp.date) ? sp.date : today;
  const [from, to] = visibleRange(view, date);

  const [rows, events, statuses, res] = await Promise.all([
    listReservations({ from: zonedToUtc(from), to: zonedToUtc(addDays(to, 1)), limit: 5000 }),
    listCalendarEvents(from, to),
    listTripStatuses(),
    getResources(),
  ]);

  const trips: CalTrip[] = rows
    .filter((x) => x.r.status !== "cancelled")
    .map(({ r, account, driver, vehicleType }) => ({
      id: r.id,
      conf: r.confNumber,
      date: toDateKey(r.pickupAt),
      time: hhmm(r.pickupAt),
      pax: r.passengerName,
      accountId: account?.id ?? null,
      account: account?.id ? (account.company ?? `${account.firstName} ${account.lastName}`) : "Walk-in",
      vehicleTypeId: r.vehicleTypeId,
      vehicle: vehicleType?.name ?? "Any vehicle",
      service: r.serviceType,
      hours: r.serviceType === "hourly" ? Math.round((r.estDurationMin / 60) * 10) / 10 : null,
      pickup: r.pickupAddress,
      dropoff: r.dropoffAddress ?? "",
      flight: r.flightNumber,
      meetGreet: r.meetGreet,
      driverId: r.driverId,
      driver: driver?.id ? fullName(driver) : null,
      tripStatusId: r.tripStatusId,
      status: r.status,
      group: r.groupName,
      total: reservationTotal(r),
      notes: r.customerNotes,
    }));

  return (
    <CalendarView
      view={view}
      date={date}
      today={today}
      trips={trips}
      events={events.map((e) => ({ id: e.id, date: e.date, time: e.time, title: e.title, kind: e.kind }))}
      statuses={statuses}
      drivers={res.drivers.filter((d) => d.status === "active").map((d) => ({ id: d.id, name: fullName(d) }))}
      vehicleTypes={res.vehicleTypes.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
