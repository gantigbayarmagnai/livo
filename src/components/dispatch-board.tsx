"use client";

import Link from "next/link";
import { useId, useState, useTransition, type KeyboardEvent } from "react";
import { assignDriver, assignVehicle, setStatus, setTripStatus } from "@/app/actions";
import type { ReservationStatus, ServiceType, TripStatus } from "@/db/schema";
import { SERVICE_LABELS, STATUS_FLOW, STATUS_LABELS } from "@/lib/labels";
import { MEET_GREET, type MeetGreet } from "@/lib/pricing";
import { TripStatusChip } from "./ui";

export type BoardTrip = {
  id: string;
  conf: number;
  date: string;
  time: string;
  status: ReservationStatus;
  tripStatusId: string | null;
  tripStatus: { name: string; color: string | null } | null;
  pax: string;
  paxCount: number;
  bags: number;
  account: string;
  service: ServiceType;
  vehicleType: string;
  hours: number | null;
  pickup: string;
  dropoff: string;
  stops: string[];
  flight: string | null;
  meetGreet: string;
  notes: string | null;
  dispatchNotes: string | null;
  driverId: string | null;
  driverName: string | null;
  vehicleId: string | null;
  vehicleName: string | null;
  total: number;
  flags: { tone: string; label: string }[];
};
type Opt = { id: string; label: string };

const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const keyToDate = (k: string) => new Date(`${k}T12:00:00Z`);
const plus = (k: string, n: number) => {
  const d = keyToDate(k);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const short = (s: string) => s.split(",")[0];

export function DispatchBoard({
  trips,
  today,
  initialSel,
  statuses,
  drivers,
  vehicles,
}: {
  trips: BoardTrip[];
  today: string;
  initialSel: string | null;
  statuses: TripStatus[];
  drivers: Opt[];
  vehicles: Opt[];
}) {
  const [sel, setSel] = useState<string | null>(initialSel ?? trips.find((t) => !t.driverId)?.id ?? null);
  const fmtDay = (k: string) =>
    (k === today ? "Today · " : k === plus(today, 1) ? "Tomorrow · " : k === plus(today, -1) ? "Yesterday · " : "") +
    keyToDate(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  const days = [...new Set(trips.map((t) => t.date))].sort();
  const selected = trips.find((t) => t.id === sel);
  const pick = (id: string) => setSel(id);
  const onKey = (e: KeyboardEvent<HTMLDivElement>, id: string) => {
    if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
      e.preventDefault();
      pick(id);
    }
  };

  return (
    <>
      <div className="board" role="list" aria-label="Trips">
        <div className="row head" role="presentation">
          <div>Time</div>
          <div>Conf #</div>
          <div>Passenger</div>
          <div>Route</div>
          <div>Status</div>
          <div>Chauffeur</div>
          <div style={{ textAlign: "right" }}>Price</div>
        </div>
        {trips.length === 0 ? <div className="empty">No trips in these three days.</div> : null}
        {days.map((day) => (
          <div key={day}>
            <div className="day">{fmtDay(day)}</div>
            {trips
              .filter((t) => t.date === day)
              .map((t) => (
                <div
                  key={t.id}
                  className={`row ${t.id === sel ? "sel" : ""}`}
                  role="listitem"
                  tabIndex={0}
                  aria-current={t.id === sel ? "true" : undefined}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("select")) return;
                    pick(t.id);
                  }}
                  onKeyDown={(e) => onKey(e, t.id)}
                >
                  <div className="time">{t.time}</div>
                  <div className="conf mono">#{t.conf}</div>
                  <div className="who">
                    <b>{t.pax}</b>
                    <small>{t.account}</small>
                  </div>
                  <div className="route">
                    {short(t.pickup)} → {short(t.dropoff || "As directed")}
                    <br />
                    <small>
                      {t.vehicleType}
                      {t.hours ? ` · ${t.hours} hrs` : ""}
                    </small>
                  </div>
                  <div className="flags">
                    {t.tripStatus && !/^(unassigned|dispatched)$/i.test(t.tripStatus.name) ? (
                      <TripStatusChip status={t.tripStatus} />
                    ) : null}
                    {t.flags.map((f, i) => (
                      <span key={i} className={`chip ${f.tone}`}>
                        {f.label}
                      </span>
                    ))}
                    {t.flags.length === 0 ? <span className="chip good">Ready</span> : null}
                  </div>
                  <div className="drv">
                    <DriverPick trip={t} drivers={drivers} />
                  </div>
                  <div className="price">{t.total ? money(t.total) : "—"}</div>
                </div>
              ))}
          </div>
        ))}
      </div>
      {selected ? <Detail t={selected} statuses={statuses} vehicles={vehicles} fmtDay={fmtDay} /> : null}
    </>
  );
}

function DriverPick({ trip, drivers }: { trip: BoardTrip; drivers: Opt[] }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`Chauffeur for #${trip.conf}`}
      className={trip.driverId ? "" : "unassigned"}
      value={trip.driverId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value || null;
        start(() => assignDriver(trip.id, v));
      }}
    >
      <option value="">Unassigned</option>
      {drivers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.label}
        </option>
      ))}
    </select>
  );
}

function briefFor(t: BoardTrip, fmtDay: (k: string) => string) {
  const mg =
    t.service === "airport_arrival"
      ? t.meetGreet === "driver"
        ? "Inside Meet & Greet at baggage claim with MGL name sign. Text the client when the flight lands."
        : t.meetGreet === "greeter"
          ? "Separate greeter meets at baggage claim and walks the client to you at the curb."
          : "Curbside. Text the client clear meeting instructions after landing."
      : "";
  return [
    "MGL LIMO WORLDWIDE · CHAUFFEUR BRIEF",
    `Conf #${t.conf} · ${fmtDay(t.date)} · Pickup ${t.time}`,
    `Chauffeur: ${t.driverName ?? "UNASSIGNED"}`,
    `Passenger: ${t.pax} (${t.account}) · ${t.paxCount} pax${t.bags ? `, ${t.bags} bags` : ""}`,
    `Vehicle: ${t.vehicleName ?? t.vehicleType}${t.hours ? ` · ${t.hours} hrs as directed` : ""}`,
    t.flight ? `Flight: ${t.flight}` : null,
    `Pickup: ${t.pickup}`,
    ...t.stops.map((s) => `Stop: ${s}`),
    `Drop-off: ${t.dropoff || "As directed"}`,
    mg ? `Meeting: ${mg}` : null,
    t.notes ? `Notes: ${t.notes}` : null,
    "",
    "STANDARDS",
    "· Front cabin clean and empty. Bottled water in the vehicle.",
    "· Black suit, black tie, white shirt.",
    "· Send interior and exterior photos to 415.699.3138 before pickup.",
    "· Be outside and ready before the client arrives.",
    "· Never discuss billing, wait time or extra stops with the client. Report them to MGL.",
    "· Issues: call or text 415.699.3138, 24/7.",
  ]
    .filter((x) => x !== null)
    .join("\n");
}

function Detail({
  t,
  statuses,
  vehicles,
  fmtDay,
}: {
  t: BoardTrip;
  statuses: TripStatus[];
  vehicles: Opt[];
  fmtDay: (k: string) => string;
}) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const uid = useId();
  const brief = briefFor(t, fmtDay);
  return (
    <div className="detail">
      <div className="panel">
        <div className="confno">
          <h2>
            Reservation <span className="mono">#{t.conf}</span>
          </h2>
          <TripStatusChip status={t.tripStatus} />
        </div>
        <dl className="kv">
          <dt>Account</dt>
          <dd>{t.account}</dd>
          <dt>Passenger</dt>
          <dd>
            {t.pax} · {t.paxCount} pax{t.bags ? `, ${t.bags} bags` : ""}
          </dd>
          <dt>When</dt>
          <dd>
            {fmtDay(t.date)}, {t.time}
          </dd>
          <dt>Service</dt>
          <dd>
            {SERVICE_LABELS[t.service]} · {t.vehicleType}
            {t.hours ? `, ${t.hours} hrs` : ""}
          </dd>
          {t.flight ? (
            <>
              <dt>Flight</dt>
              <dd>{t.flight}</dd>
            </>
          ) : null}
          {t.service === "airport_arrival" ? (
            <>
              <dt>Meet &amp; Greet</dt>
              <dd>{MEET_GREET[(t.meetGreet as MeetGreet) || "none"]?.label}</dd>
            </>
          ) : null}
          <dt>Pickup</dt>
          <dd>{t.pickup}</dd>
          <dt>Drop-off</dt>
          <dd>{t.dropoff || "As directed"}</dd>
          {t.notes ? (
            <>
              <dt>Notes</dt>
              <dd>{t.notes}</dd>
            </>
          ) : null}
          {t.dispatchNotes ? (
            <>
              <dt>Dispatch notes</dt>
              <dd>{t.dispatchNotes}</dd>
            </>
          ) : null}
          <dt>Price</dt>
          <dd className="mono">{t.total ? money(t.total) : "Needs staff price"}</dd>
          <dt>
            <label htmlFor={`${uid}ts`}>Trip status</label>
          </dt>
          <dd>
            <select
              id={`${uid}ts`}
              className="select-sm"
              value={t.tripStatusId ?? ""}
              disabled={pending}
              onChange={(e) => {
                const v = e.target.value;
                start(() => setTripStatus(t.id, v));
              }}
            >
              {!t.tripStatusId ? <option value="">No status</option> : null}
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </dd>
          <dt>
            <label htmlFor={`${uid}st`}>Progress</label>
          </dt>
          <dd>
            <select
              id={`${uid}st`}
              className="select-sm"
              value={t.status}
              disabled={pending}
              onChange={(e) => {
                const v = e.target.value as ReservationStatus;
                start(() => setStatus(t.id, v));
              }}
            >
              {STATUS_FLOW.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </dd>
          <dt>
            <label htmlFor={`${uid}vh`}>Vehicle</label>
          </dt>
          <dd>
            <select
              id={`${uid}vh`}
              className="select-sm"
              value={t.vehicleId ?? ""}
              disabled={pending}
              onChange={(e) => {
                const v = e.target.value || null;
                start(() => assignVehicle(t.id, v));
              }}
            >
              <option value="">No vehicle yet</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </dd>
        </dl>
        <div className="actions">
          <Link className="btn small" href={`/reservations/${t.id}`}>
            Edit reservation
          </Link>
        </div>
      </div>
      <div className="panel">
        <div className="confno">
          <h2>Chauffeur brief</h2>
          <button
            type="button"
            className="btn small"
            onClick={() =>
              navigator.clipboard
                ?.writeText(brief)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                })
                .catch(() => {})
            }
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="brief">{brief}</pre>
      </div>
    </div>
  );
}
