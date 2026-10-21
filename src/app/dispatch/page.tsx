import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DispatchBoard, type BoardTrip } from "@/components/dispatch-board";
import { DriverSchedule } from "@/components/driver-schedule";
import { Loading, ViewHead } from "@/components/ui";
import { ACTIVE_STATUSES, fullName, reservationTotal } from "@/lib/labels";
import { computeWarnings, getResources, listReservations, listShifts, listTripStatuses } from "@/lib/queries";
import { addDays, hhmm, isDateKey, toDateKey, todayKey, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Dispatch" };

type Search = { mode?: string; date?: string; sel?: string };

export default function DispatchPage({ searchParams }: PageProps<"/dispatch">) {
  return (
    <Suspense
      fallback={
        <>
          <ViewHead eyebrow="Dispatch" title="Dispatch grid" />
          <Loading rows={8} />
        </>
      }
    >
      <Dispatch searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

async function Dispatch({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const sp = await searchParams;
  const today = todayKey();
  const date = isDateKey(sp.date) ? sp.date : today;
  const mode = sp.mode === "schedule" ? "schedule" : "grid";
  const days = mode === "grid" ? 3 : 1;
  const from = zonedToUtc(date);
  const to = zonedToUtc(addDays(date, days));

  const [rows, res, shifts, statuses] = await Promise.all([
    listReservations({ from, to }),
    getResources(),
    listShifts(zonedToUtc(addDays(date, -1)), zonedToUtc(addDays(date, days + 1))),
    listTripStatuses(),
  ]);
  const warnings = computeWarnings(rows, shifts, res.vehicleTypes);

  const tabs = (
    <div className="subtabs">
      <Link className="subtab" aria-current={mode === "grid" ? "page" : undefined} href={`/dispatch?date=${date}`}>
        Dispatch grid
      </Link>
      <Link
        className="subtab"
        aria-current={mode === "schedule" ? "page" : undefined}
        href={`/dispatch?mode=schedule&date=${date}`}
      >
        Driver schedule
      </Link>
    </div>
  );

  if (mode === "schedule") {
    return (
      <>
        <ViewHead eyebrow="Dispatch" title="Driver schedule" />
        {tabs}
        <DriverSchedule date={date} today={today} rows={rows} shifts={shifts} res={res} />
      </>
    );
  }

  const vehicleOf = (id: string | null) => res.vehicles.find((v) => v.id === id);
  const trips: BoardTrip[] = rows
    .filter((x) => ACTIVE_STATUSES.includes(x.r.status) || x.r.status === "quote")
    .map(({ r, account, driver, vehicleType, tripStatus }) => {
      const flags: { tone: string; label: string }[] = [];
      if (r.status === "quote") flags.push({ tone: "info", label: "Quote" });
      if (!r.driverId && r.status !== "quote") flags.push({ tone: "crit", label: "Needs driver" });
      for (const w of warnings.get(r.id) ?? [])
        flags.push({ tone: w.kind === "off_shift" ? "warn" : "crit", label: w.message });
      const v = vehicleOf(r.vehicleId);
      if (v && r.vehicleTypeId && v.vehicleTypeId !== r.vehicleTypeId) {
        const booked = res.vehicleTypes.find((t) => t.id === r.vehicleTypeId);
        const bigger =
          (res.vehicleTypes.find((t) => t.id === v.vehicleTypeId)?.capacity ?? 0) > (booked?.capacity ?? 0);
        flags.push({ tone: bigger ? "info" : "crit", label: bigger ? "Free upgrade" : `${v.name} is a ${v.typeName}` });
      }
      if (Number(r.baseRate) === 0) flags.push({ tone: "warn", label: "Price needed" });
      if (["en_route", "on_location", "passenger_on_board"].includes(r.status))
        flags.push({
          tone: "good",
          label: { en_route: "En route", on_location: "On location", passenger_on_board: "POB" }[
            r.status as "en_route"
          ],
        });
      return {
        id: r.id,
        conf: r.confNumber,
        date: toDateKey(r.pickupAt),
        time: hhmm(r.pickupAt),
        status: r.status,
        tripStatusId: r.tripStatusId,
        tripStatus: tripStatus?.id ? { name: tripStatus.name, color: tripStatus.color } : null,
        pax: r.passengerName,
        paxCount: r.passengerCount,
        bags: r.luggageCount,
        account: account?.id ? (account.company ?? `${account.firstName} ${account.lastName}`) : "Walk-in",
        service: r.serviceType,
        vehicleType: vehicleType?.name ?? "Any vehicle",
        hours: r.serviceType === "hourly" ? Math.round((r.estDurationMin / 60) * 10) / 10 : null,
        pickup: r.pickupAddress,
        dropoff: r.dropoffAddress ?? "",
        stops: r.stops,
        flight: r.flightNumber,
        meetGreet: r.meetGreet,
        notes: r.customerNotes,
        dispatchNotes: r.dispatchNotes,
        driverId: r.driverId,
        driverName: driver?.id ? fullName(driver) : null,
        vehicleId: r.vehicleId,
        vehicleName: v ? `${v.name} · ${v.typeName}` : null,
        total: reservationTotal(r),
        flags,
      };
    });

  const firstDay = trips.filter((t) => t.date === date);
  const unassigned = trips.filter((t) => !t.driverId && t.status !== "quote");
  const conflicts = trips.filter((t) => t.flags.some((f) => f.tone === "crit" && f.label !== "Needs driver"));
  const isToday = date === today;

  return (
    <>
      <ViewHead
        eyebrow="Dispatch"
        title={isToday ? "Dispatch grid · next 3 days" : `Dispatch grid · 3 days from ${date}`}
        actions={
          <>
            <Link className="btn" href={`/dispatch?date=${addDays(date, -1)}`} aria-label="Previous day">
              ‹
            </Link>
            {!isToday ? (
              <Link className="btn" href="/dispatch">
                Today
              </Link>
            ) : null}
            <Link className="btn" href={`/dispatch?date=${addDays(date, 1)}`} aria-label="Next day">
              ›
            </Link>
            <Link className="btn primary" href="/reservations/new">
              New Res/Quote
            </Link>
          </>
        }
      />
      {tabs}
      <div className="stats">
        <div className="stat">
          <div className="eyebrow">{isToday ? "Trips today" : "Trips first day"}</div>
          <div className="n">{firstDay.length}</div>
        </div>
        <div className={`stat ${unassigned.length ? "crit" : ""}`}>
          <div className="eyebrow">Need a driver</div>
          <div className="n">{unassigned.length}</div>
        </div>
        <div className={`stat ${conflicts.length ? "warn" : ""}`}>
          <div className="eyebrow">Conflicts</div>
          <div className="n">{conflicts.length}</div>
        </div>
        <div className="stat">
          <div className="eyebrow">{isToday ? "Booked today" : "Booked first day"}</div>
          <div className="n">
            ${firstDay.reduce((s, t) => s + t.total, 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
      <DispatchBoard
        trips={trips}
        today={today}
        initialSel={sp.sel ?? null}
        statuses={statuses}
        drivers={res.drivers
          .filter((d) => d.status === "active")
          .map((d) => ({
            id: d.id,
            label: `${fullName(d)}${vehicleOf(d.defaultVehicleId) ? ` · ${vehicleOf(d.defaultVehicleId)!.name}` : ""}`,
          }))}
        vehicles={res.vehicles.filter((v) => v.active).map((v) => ({ id: v.id, label: `${v.name} · ${v.typeName}` }))}
      />
    </>
  );
}
