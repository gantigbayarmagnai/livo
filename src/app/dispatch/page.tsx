import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DateNav } from "@/components/date-nav";
import { DriverSelect, StatusSelect, VehicleSelect } from "@/components/trip-controls";
import { DriverDot, Empty, LoadingRows, PageHeader } from "@/components/ui";
import { ACTIVE_STATUSES, SERVICE_LABELS, fullName } from "@/lib/labels";
import { computeWarnings, dayTrips, getResources, listShifts, type ReservationRow, type Warning } from "@/lib/queries";
import { addDays, addMinutes, dayRange, formatDayKey, formatTime, isDateKey, todayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Dispatch" };

type Search = { date?: string; view?: string };

export default function DispatchPage({ searchParams }: PageProps<"/dispatch">) {
  return (
    <Suspense fallback={<LoadingRows rows={8} />}>
      <DispatchBoard searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

const VIEWS = [
  { key: "all", label: "All trips" },
  { key: "needs", label: "Needs driver" },
  { key: "active", label: "In progress" },
  { key: "closed", label: "Done & cancelled" },
] as const;

async function DispatchBoard({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const sp = await searchParams;
  const today = todayKey();
  const date = isDateKey(sp.date) ? sp.date : today;
  const view = VIEWS.some((v) => v.key === sp.view) ? sp.view! : "all";
  const { start, end } = dayRange(date);

  const [rows, res, shifts] = await Promise.all([dayTrips(date), getResources(), listShifts(start, end)]);
  const warnings = computeWarnings(rows, shifts, res.vehicleTypes);

  const live = rows.filter((x) => x.r.status !== "cancelled" && x.r.status !== "no_show");
  const needsDriver = live.filter((x) => !x.r.driverId && x.r.status !== "quote" && x.r.status !== "done");
  const flagged = rows.filter((x) => warnings.has(x.r.id));

  const shown = rows.filter((x) => {
    if (view === "needs") return !x.r.driverId && x.r.status !== "quote" && ACTIVE_STATUSES.includes(x.r.status);
    if (view === "active") return ["en_route", "on_location", "passenger_on_board"].includes(x.r.status);
    if (view === "closed") return ["done", "cancelled", "no_show"].includes(x.r.status);
    return true;
  });

  const onShift = new Set(shifts.map((s) => s.driverId));
  const driverOpts = res.drivers
    .filter((d) => d.status === "active")
    .map((d) => ({ id: d.id, label: fullName(d), muted: !onShift.has(d.id) }));
  const vehicleOpts = res.vehicles
    .filter((v) => v.active)
    .map((v) => ({ id: v.id, label: `${v.name} · ${v.typeName}` }));

  const extra = view === "all" ? "" : `&view=${view}`;

  return (
    <>
      <PageHeader
        title={formatDayKey(date)}
        sub={
          <span>
            {live.length} trips
            {needsDriver.length ? (
              <span className="font-semibold text-signal"> · {needsDriver.length} need a driver</span>
            ) : null}
            {flagged.length ? (
              <span className="font-semibold text-stop"> · {flagged.length} with conflicts</span>
            ) : null}
          </span>
        }
        actions={
          <DateNav
            path="/dispatch"
            date={date}
            today={today}
            prev={addDays(date, -1)}
            next={addDays(date, 1)}
            extra={extra}
          />
        }
      />

      <div className="space-y-5 px-4 py-5 md:px-8">
        <DriverLanes
          date={date}
          rows={live}
          shifts={shifts}
          drivers={res.drivers.filter((d) => d.status === "active")}
          showNow={date === today}
        />

        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter trips">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              href={`/dispatch?date=${date}${v.key === "all" ? "" : `&view=${v.key}`}`}
              className={`rounded-md px-3 py-1.5 text-[14px] font-semibold ${
                view === v.key ? "bg-ink text-white" : "text-ink-2 hover:bg-line/60"
              }`}
            >
              {v.label}
              {v.key === "needs" && needsDriver.length ? ` (${needsDriver.length})` : ""}
            </Link>
          ))}
        </div>

        {shown.length === 0 ? (
          <Empty>
            {rows.length === 0 ? (
              <>
                No trips on this day.{" "}
                <Link className="font-semibold text-route underline" href="/reservations/new">
                  Book one
                </Link>
              </>
            ) : (
              "Nothing in this view. Every trip here is taken care of."
            )}
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <thead className="border-b border-line text-[13px] text-ink-3">
                <tr>
                  <th className="w-[92px] py-2 pl-4 font-medium">Pickup</th>
                  <th className="w-[132px] py-2 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Passenger</th>
                  <th className="py-2 pr-3 font-medium">Route</th>
                  <th className="w-[180px] py-2 pr-2 font-medium">Driver</th>
                  <th className="w-[180px] py-2 pr-4 font-medium">Vehicle</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((x) => (
                  <TripRow
                    key={x.r.id}
                    x={x}
                    warnings={warnings.get(x.r.id)}
                    driverOpts={driverOpts}
                    vehicleOpts={vehicleOpts}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function TripRow({
  x,
  warnings,
  driverOpts,
  vehicleOpts,
}: {
  x: ReservationRow;
  warnings?: Warning[];
  driverOpts: { id: string; label: string; muted?: boolean }[];
  vehicleOpts: { id: string; label: string }[];
}) {
  const r = x.r;
  const closed = r.status === "done" || r.status === "cancelled" || r.status === "no_show";
  const label = `#${r.confNumber} ${r.passengerName}`;
  const time = formatTime(r.pickupAt);
  const [hm, ampm] = time.split(" ");
  return (
    <tr
      className={`border-b border-line align-top last:border-0 ${closed ? "text-ink-3" : ""} ${warnings ? "bg-stop-wash/50" : ""}`}
    >
      <td className="py-2.5 pl-4">
        <div className={`font-cond text-[26px] font-bold leading-none ${closed ? "" : "text-ink"}`}>
          {hm}
          <span className="ml-0.5 text-[14px] font-semibold text-ink-3">{ampm}</span>
        </div>
        <Link href={`/reservations/${r.id}`} className="mt-1 inline-block text-[13px] text-route hover:underline">
          #{r.confNumber}
        </Link>
      </td>
      <td className="py-2.5 pr-3">
        <StatusSelect id={r.id} status={r.status} label={label} />
      </td>
      <td className="py-2.5 pr-3">
        <Link href={`/reservations/${r.id}`} className="font-semibold hover:underline">
          {r.passengerName}
        </Link>
        <div className="text-[13px] text-ink-2">
          {r.passengerCount} pax
          {r.luggageCount ? ` · ${r.luggageCount} bag${r.luggageCount === 1 ? "" : "s"}` : ""} ·{" "}
          {x.vehicleType?.name ?? "Any vehicle"}
        </div>
        {x.account?.company ? <div className="text-[13px] text-ink-3">{x.account.company}</div> : null}
      </td>
      <td className="py-2.5 pr-3 text-[14px]">
        <div className="text-[13px] font-semibold text-ink-2">
          {SERVICE_LABELS[r.serviceType]}
          {r.flightNumber ? ` · ${r.airline ?? ""} ${r.flightNumber}` : ""}
        </div>
        <div>{r.pickupAddress}</div>
        {r.stops.map((s, i) => (
          <div key={i} className="text-ink-2">
            via {s}
          </div>
        ))}
        {r.dropoffAddress ? <div className="text-ink-2">to {r.dropoffAddress}</div> : null}
        {r.customerNotes ? <div className="mt-1 text-[13px] italic text-ink-2">“{r.customerNotes}”</div> : null}
        {warnings?.map((w, i) => (
          <div key={i} className="mt-1 text-[13px] font-semibold text-stop">
            {w.message}
          </div>
        ))}
      </td>
      <td className="py-2.5 pr-2">
        <DriverSelect id={r.id} driverId={r.driverId} options={driverOpts} label={label} />
      </td>
      <td className="py-2.5 pr-4">
        <VehicleSelect id={r.id} vehicleId={r.vehicleId} options={vehicleOpts} label={label} />
      </td>
    </tr>
  );
}

/** One lane per driver: shift band behind, trip bars on top. */
function DriverLanes({
  date,
  rows,
  shifts,
  drivers,
  showNow,
}: {
  date: string;
  rows: ReservationRow[];
  shifts: { driverId: string; startsAt: Date; endsAt: Date }[];
  drivers: { id: string; firstName: string; lastName: string; color: string }[];
  showNow: boolean;
}) {
  const { start } = dayRange(date);
  const FIRST = 4 * 60,
    LAST = 24 * 60,
    SPAN = LAST - FIRST;
  const pos = (d: Date) => {
    const m = (d.getTime() - start.getTime()) / 60000;
    return Math.min(100, Math.max(0, ((m - FIRST) / SPAN) * 100));
  };
  const hours = Array.from({ length: (LAST - FIRST) / 60 / 2 + 1 }, (_, i) => FIRST / 60 + i * 2);
  const unassigned = rows.filter((x) => !x.r.driverId && x.r.status !== "done" && x.r.status !== "quote");
  const lanes = [
    ...drivers.map((d) => ({
      key: d.id,
      name: fullName(d),
      color: d.color,
      trips: rows.filter((x) => x.r.driverId === d.id),
    })),
    ...(unassigned.length
      ? [
          {
            key: "none",
            name: "Needs driver",
            color: "var(--signal)",
            trips: unassigned,
          },
        ]
      : []),
  ];
  const now = pos(new Date());

  return (
    <section aria-label="Driver timeline" className="overflow-x-auto rounded-lg border border-line bg-surface">
      <div className="min-w-[900px] px-4 py-3">
        <div className="relative ml-40 h-5 text-[12px] text-ink-3">
          {hours.map((h) => (
            <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h * 60 - FIRST) / SPAN) * 100}%` }}>
              {h === 12 ? "12p" : h === 24 ? "12a" : h > 12 ? `${h - 12}p` : `${h}a`}
            </span>
          ))}
        </div>
        <div className="space-y-1">
          {lanes.map((lane) => (
            <div key={lane.key} className="flex items-center">
              <div
                className={`flex w-40 shrink-0 items-center gap-2 truncate pr-3 text-[14px] ${lane.key === "none" ? "font-semibold text-signal" : ""}`}
              >
                <DriverDot color={lane.color} />
                {lane.name}
              </div>
              <div className="relative h-7 flex-1 rounded bg-paper">
                {shifts
                  .filter((s) => s.driverId === lane.key)
                  .map((s, i) => (
                    <div
                      key={i}
                      title={`On shift ${formatTime(s.startsAt)}–${formatTime(s.endsAt)}`}
                      className="absolute inset-y-0 rounded bg-route-wash"
                      style={{
                        left: `${pos(s.startsAt)}%`,
                        width: `${pos(s.endsAt) - pos(s.startsAt)}%`,
                      }}
                    />
                  ))}
                {lane.trips.map((x) => {
                  const l = pos(x.r.pickupAt);
                  const w = Math.max(0.8, pos(addMinutes(x.r.pickupAt, x.r.estDurationMin)) - l);
                  const done = x.r.status === "done";
                  return (
                    <Link
                      key={x.r.id}
                      href={`/reservations/${x.r.id}`}
                      title={`#${x.r.confNumber} ${formatTime(x.r.pickupAt)} ${x.r.passengerName}`}
                      className="absolute inset-y-1 overflow-hidden rounded-sm px-1 text-[11px] font-semibold leading-5 text-white hover:z-10 hover:ring-2 hover:ring-ink"
                      style={{
                        left: `${l}%`,
                        width: `${w}%`,
                        background: lane.color,
                        opacity: done ? 0.4 : 0.92,
                      }}
                    >
                      {x.r.confNumber}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {showNow && now > 0 && now < 100 ? (
          <div className="pointer-events-none relative ml-40 h-0">
            <div
              className="absolute bottom-0 w-0.5 bg-stop"
              style={{ left: `${now}%`, height: `${lanes.length * 32 + 4}px` }}
              aria-hidden
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
