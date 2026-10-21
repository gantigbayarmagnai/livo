import Link from "next/link";
import { addShift, deleteShift } from "@/app/actions";
import { ACTIVE_STATUSES, fullName } from "@/lib/labels";
import type { DriverShift } from "@/db/schema";
import type { ReservationRow, Resources } from "@/lib/queries";
import { addDays, addMinutes, dayRange, formatDayKey, hhmm, toDateKey } from "@/lib/time";
import { ActionButton, InlineForm } from "./resource-forms";

const T0 = 3 * 60; // timeline runs 3 AM → 3 AM
const SPAN = 24 * 60;
const pct = (m: number) => `${((Math.min(Math.max(m, 0), SPAN) / SPAN) * 100).toFixed(3)}%`;
const hm = (m: number) => {
  const t = (m + T0) % 1440;
  const h = Math.floor(t / 60);
  return `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
};

/** One row per chauffeur: shift band behind, trips on top, like the prototype's sheet view. */
export function DriverSchedule({
  date,
  today,
  rows,
  shifts,
  res,
}: {
  date: string;
  today: string;
  rows: ReservationRow[];
  shifts: DriverShift[];
  res: Resources;
}) {
  const { start } = dayRange(date);
  const rel = (d: Date) => (d.getTime() - start.getTime()) / 60000 - T0;
  const trips = rows.filter(
    (x) => toDateKey(x.r.pickupAt) === date && (ACTIVE_STATUSES.includes(x.r.status) || x.r.status === "done"),
  );
  const dayShifts = shifts.filter((s) => rel(s.endsAt) > 0 && rel(s.startsAt) < SPAN);
  const drivers = res.drivers.filter((d) => d.status === "active");
  const working = drivers.filter((d) => dayShifts.some((s) => s.driverId === d.id));
  const off = drivers.filter((d) => !working.includes(d));
  const usedVehicles = new Set(
    [...trips.map((x) => x.r.vehicleId), ...working.map((d) => d.defaultVehicleId)].filter(Boolean),
  );
  const idle = res.vehicles.filter((v) => v.active && !usedVehicles.has(v.id));
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 3));
  const now = date === today ? rel(new Date()) : null;

  const overlaps = (a: ReservationRow) =>
    trips.some(
      (b) =>
        b !== a &&
        b.r.driverId &&
        b.r.driverId === a.r.driverId &&
        a.r.pickupAt < addMinutes(b.r.pickupAt, b.r.estDurationMin) &&
        b.r.pickupAt < addMinutes(a.r.pickupAt, a.r.estDurationMin),
    );

  const grid = Array.from({ length: 9 }, (_, i) => i * 3 * 60);
  const track = (driverId: string | null) => (
    <div className="track">
      {grid.map((m) => (
        <div key={m} className="hr" style={{ left: pct(m) }} />
      ))}
      {driverId
        ? dayShifts
            .filter((s) => s.driverId === driverId)
            .map((s) => (
              <div
                key={s.id}
                className="shift"
                style={{ left: pct(rel(s.startsAt)), width: `calc(${pct(rel(s.endsAt))} - ${pct(rel(s.startsAt))})` }}
                title={`On shift ${hhmm(s.startsAt)}–${hhmm(s.endsAt)}`}
              />
            ))
        : null}
      {trips
        .filter((x) => x.r.driverId === driverId)
        .map((x, i) => {
          const a = rel(x.r.pickupAt);
          const b = rel(addMinutes(x.r.pickupAt, x.r.estDurationMin));
          return (
            <Link
              key={x.r.id}
              href={`/dispatch?date=${date}&sel=${x.r.id}`}
              className={`bar ${overlaps(x) ? "crit" : ""}`}
              style={{ top: 1 + (i % 2) * 18, left: pct(a), width: `max(100px, calc(${pct(b)} - ${pct(a)}))` }}
              title={`#${x.r.confNumber} ${hhmm(x.r.pickupAt)} ${x.r.passengerName}`}
            >
              {hhmm(x.r.pickupAt)} #{x.r.confNumber}
            </Link>
          );
        })}
      {now !== null && now > 0 && now < SPAN ? <div className="now" style={{ left: pct(now) }} title="Now" /> : null}
    </div>
  );

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="eyebrow">Chauffeurs working</div>
          <div className="n">{working.length}</div>
        </div>
        <div className="stat">
          <div className="eyebrow">Trips</div>
          <div className="n">{trips.length}</div>
        </div>
        <div className={`stat ${idle.length ? "warn" : ""}`}>
          <div className="eyebrow">Vehicles with no driver</div>
          <div className="n">{idle.length}</div>
        </div>
        <div className="stat">
          <div className="eyebrow">Off today</div>
          <div className="n">{off.length}</div>
        </div>
      </div>
      <div className="sch-days">
        {days.map((d) => (
          <Link
            key={d}
            className="subtab"
            aria-current={d === date ? "page" : undefined}
            href={`/dispatch?mode=schedule&date=${d}`}
          >
            {d === today ? "Today · " : ""}
            {formatDayKey(d, { weekday: "short", month: "short", day: "numeric" })}
          </Link>
        ))}
      </div>
      <div className="sch">
        <div className="sch-grid">
          <div className="sch-axis">
            <div style={{ padding: "5px 10px" }}>Chauffeur</div>
            <div style={{ padding: "5px 10px" }}>Plate · vehicle</div>
            <div className="ax">
              {grid.map((m) => (
                <span key={m} style={{ left: pct(m) }}>
                  {hm(m)}
                </span>
              ))}
            </div>
          </div>
          <div className="sch-sec">Chauffeurs</div>
          {drivers.map((d) => {
            const v = res.vehicles.find((x) => x.id === d.defaultVehicleId);
            const myShifts = dayShifts.filter((s) => s.driverId === d.id);
            return (
              <div key={d.id} className={`sch-row ${myShifts.length ? "" : "idle"}`}>
                <div className="nm">
                  {fullName(d)}
                  <small>
                    {myShifts.length
                      ? myShifts.map((s) => (
                          <span key={s.id} style={{ whiteSpace: "nowrap" }}>
                            {hhmm(s.startsAt)}–{hhmm(s.endsAt)}{" "}
                            <ActionButton
                              run={deleteShift.bind(null, s.id)}
                              className="more"
                              label={`Remove ${fullName(d)}'s shift`}
                            >
                              ×
                            </ActionButton>
                          </span>
                        ))
                      : "Off"}
                  </small>
                </div>
                <div className="veh">
                  {v ? <span className="mono">{v.name}</span> : null}
                  <small>{v ? v.typeName : "—"}</small>
                </div>
                <div>{track(d.id)}</div>
              </div>
            );
          })}
          {trips.some((x) => !x.r.driverId) ? (
            <>
              <div className="sch-sec">Needs a chauffeur</div>
              <div className="sch-row">
                <div className="nm" style={{ color: "var(--crit)" }}>
                  Unassigned
                </div>
                <div className="veh">
                  <small>—</small>
                </div>
                <div>{track(null)}</div>
              </div>
            </>
          ) : null}
          {idle.length ? (
            <>
              <div className="sch-sec">Vehicles with no driver</div>
              {idle.map((v) => (
                <div key={v.id} className="sch-row idle">
                  <div className="nm">No driver</div>
                  <div className="veh">
                    <span className="mono">{v.name}</span>
                    <small>{v.typeName}</small>
                  </div>
                  <div />
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Add a shift</h2>
        <InlineForm action={addShift} submitLabel="Add shift" savedLabel="Shift added.">
          <label className="field">
            <span className="flabel">Chauffeur</span>
            <select name="driverId" required>
              <option value="">Choose…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {fullName(d)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="flabel">Date</span>
            <input name="date" type="date" defaultValue={date} required />
          </label>
          <label className="field">
            <span className="flabel">Starts</span>
            <input name="start" type="time" defaultValue="06:00" required />
          </label>
          <label className="field">
            <span className="flabel">Ends</span>
            <input name="end" type="time" defaultValue="16:00" required />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 180 }}>
            <span className="flabel">Note</span>
            <input name="notes" placeholder="Optional" />
          </label>
        </InlineForm>
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 12.5 }}>
          Shaded bands are shifts, gold bars are trips (red when a chauffeur is double-booked). An end time before the
          start runs past midnight.
        </p>
      </div>
    </>
  );
}
