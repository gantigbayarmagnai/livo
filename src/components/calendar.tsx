"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState, useTransition, type MouseEvent } from "react";
import { addCalendarEvent, deleteCalendarEvent, setTripStatus, type FormState } from "@/app/actions";
import type { ReservationStatus, ServiceType, TripStatus } from "@/db/schema";
import { SERVICE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { MEET_GREET, type MeetGreet } from "@/lib/pricing";
import { TripStatusChip, ViewHead } from "./ui";

export type CalView = "month" | "week" | "day";
export type CalTrip = {
  id: string;
  conf: number;
  date: string;
  time: string;
  pax: string;
  accountId: string | null;
  account: string;
  vehicleTypeId: string | null;
  vehicle: string;
  service: ServiceType;
  hours: number | null;
  pickup: string;
  dropoff: string;
  flight: string | null;
  meetGreet: string;
  driverId: string | null;
  driver: string | null;
  tripStatusId: string | null;
  status: ReservationStatus;
  group: string | null;
  total: number;
  notes: string | null;
};
export type CalEvent = { id: string; date: string; time: string | null; title: string; kind: string };

type Item = { k: "t"; time: string; t: CalTrip } | { k: "e"; time: string; e: CalEvent };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const keyToDate = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};
const dateToKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const plus = (k: string, n: number) => {
  const d = keyToDate(k);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToKey(d);
};
const fmt = (k: string, o: Intl.DateTimeFormatOptions) =>
  keyToDate(k).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function CalendarView({
  view,
  date,
  today,
  trips,
  events,
  statuses,
  drivers,
  vehicleTypes,
}: {
  view: CalView;
  date: string;
  today: string;
  trips: CalTrip[];
  events: CalEvent[];
  statuses: TripStatus[];
  drivers: { id: string; name: string }[];
  vehicleTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [navPending, startNav] = useTransition();
  const [filters, setFilters] = useState({
    driver: "",
    vtype: "",
    account: "",
    service: "",
    status: "",
    group: "",
    events: true,
  });
  const [sel, setSel] = useState<{ kind: "t" | "e"; id: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = (m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const fmtDay = (k: string) =>
    (k === today ? "Today · " : k === plus(today, 1) ? "Tomorrow · " : k === plus(today, -1) ? "Yesterday · " : "") +
    fmt(k, { weekday: "short", month: "short", day: "numeric" });

  const statusOf = (t: CalTrip) =>
    statuses.find((s) => s.id === t.tripStatusId) ??
    statuses.find((s) => s.name.toLowerCase() === (t.driverId ? "dispatched" : "unassigned")) ??
    null;

  const go = (v: CalView, d: string) => {
    setSel(null);
    startNav(() => router.push(`/calendar?view=${v}&date=${d}`));
  };
  const step = (n: number) => {
    if (view === "month") {
      const [y, m] = date.split("-").map(Number);
      const t = new Date(Date.UTC(y, m - 1 + n, 1, 12));
      go(view, dateToKey(t));
    } else go(view, plus(date, (view === "week" ? 7 : 1) * n));
  };

  const pass = (t: CalTrip) =>
    (!filters.driver || (filters.driver === "_none" ? !t.driverId : t.driverId === filters.driver)) &&
    (!filters.vtype || t.vehicleTypeId === filters.vtype) &&
    (!filters.account || t.account === filters.account) &&
    (!filters.service || t.service === filters.service) &&
    (!filters.status || statusOf(t)?.id === filters.status) &&
    (!filters.group || t.group === filters.group);

  const itemsOn = (day: string): Item[] => {
    const ts: Item[] = trips.filter((t) => t.date === day && pass(t)).map((t) => ({ k: "t", time: t.time, t }));
    const es: Item[] = filters.events
      ? events.filter((e) => e.date === day).map((e) => ({ k: "e", time: e.time ?? "00:00", e }))
      : [];
    return [...ts, ...es].sort((a, b) => mins(a.time) - mins(b.time));
  };

  // ---------- Hover preview ----------
  const [pop, setPop] = useState<{ item: Item; x: number; y: number } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hide = () => setPop(null);
    document.addEventListener("scroll", hide, { passive: true });
    return () => document.removeEventListener("scroll", hide);
  }, []);
  useEffect(() => {
    const el = popRef.current;
    if (!el || !pop) return;
    const r = el.getBoundingClientRect();
    const padPx = 12;
    let left = pop.x + 16;
    let top = pop.y + 16;
    if (left + r.width > innerWidth - padPx) left = pop.x - r.width - 16;
    if (top + r.height > innerHeight - padPx) top = Math.max(padPx, innerHeight - r.height - padPx);
    el.style.left = `${Math.max(padPx, left)}px`;
    el.style.top = `${top}px`;
  }, [pop]);
  const hover = (item: Item) => ({
    onMouseEnter: (e: MouseEvent) => setPop({ item, x: e.clientX, y: e.clientY }),
    onMouseMove: (e: MouseEvent) => setPop((p) => (p ? { ...p, x: e.clientX, y: e.clientY } : p)),
    onMouseLeave: () => setPop(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setPop({ item, x: r.right - 8, y: r.top });
    },
    onBlur: () => setPop(null),
  });

  const evBtn = (it: Item, full: boolean) => {
    if (it.k === "t") {
      const st = statusOf(it.t);
      const c = st?.color;
      const selected = sel?.kind === "t" && sel.id === it.t.id;
      return (
        <button
          key={it.t.id}
          type="button"
          className={`ev ${c ? "" : "nocolor"} ${selected ? "sel" : ""}`}
          style={{ "--c": c || "var(--line)" } as React.CSSProperties}
          onClick={() => setSel({ kind: "t", id: it.t.id })}
          {...hover(it)}
        >
          <span className="mono">{it.t.time}</span> #{it.t.conf} {it.t.pax}
          {full ? ` · ${it.t.vehicle} · ${st?.name ?? ""}` : ""}
        </button>
      );
    }
    return (
      <button
        key={it.e.id}
        type="button"
        className="ev nonres"
        style={{ "--c": "var(--muted)" } as React.CSSProperties}
        onClick={() => setSel({ kind: "e", id: it.e.id })}
        {...hover(it)}
      >
        {it.e.time ? <span className="mono">{it.e.time} </span> : null}
        {it.e.title}
      </button>
    );
  };

  // ---------- Body ----------
  let title = "";
  let body: React.ReactNode = null;
  if (view === "month") {
    title = fmt(`${date.slice(0, 7)}-01`, { month: "long", year: "numeric" });
    const first = `${date.slice(0, 7)}-01`;
    const start = plus(first, -keyToDate(first).getUTCDay());
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < 42; i++) {
      const day = plus(start, i);
      const out = day.slice(0, 7) !== date.slice(0, 7);
      if (i === 35 && out) break;
      const its = itemsOn(day);
      cells.push(
        <div key={day} className={`cell ${out ? "out" : ""} ${day === today ? "today" : ""}`}>
          <button type="button" className="dnum" onClick={() => go("day", day)} aria-label={`Open ${fmtDay(day)}`}>
            {Number(day.slice(8))}
          </button>
          {its.slice(0, 4).map((it) => evBtn(it, false))}
          {its.length > 4 ? (
            <button type="button" className="more" onClick={() => go("day", day)}>
              +{its.length - 4} more
            </button>
          ) : null}
          {its.length ? <div className="cnt">{its.length}</div> : null}
        </div>,
      );
    }
    body = (
      <div className="month">
        {DOW.map((d) => (
          <div key={d} className="dow">
            {d}
          </div>
        ))}
        {cells}
      </div>
    );
  } else if (view === "week") {
    const start = plus(date, -keyToDate(date).getUTCDay());
    const end = plus(start, 6);
    title = `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(end, { month: "short", day: "numeric", year: "numeric" })}`;
    body = (
      <div className="weekgrid">
        {Array.from({ length: 7 }, (_, i) => {
          const day = plus(start, i);
          const its = itemsOn(day);
          return (
            <div key={day} className={`weekcol ${day === today ? "today" : ""}`}>
              <h3>
                <button type="button" className="dnum" onClick={() => go("day", day)}>
                  {fmt(day, { weekday: "short", day: "numeric" })}
                </button>
              </h3>
              {its.length ? (
                its.map((it) => evBtn(it, true))
              ) : (
                <div className="muted" style={{ fontSize: 12, padding: "4px 6px" }}>
                  No trips
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  } else {
    title = fmt(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const its = itemsOn(date);
    body = (
      <div className="dayview">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="hour">
            <div className="h">{pad(h)}:00</div>
            <div className="slot">
              {its.filter((it) => Math.floor(mins(it.time) / 60) === h).map((it) => evBtn(it, true))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const accounts = [...new Set(trips.map((t) => t.account))].sort();
  const groups = [...new Set(trips.map((t) => t.group).filter(Boolean))] as string[];
  const selTrip = sel?.kind === "t" ? trips.find((t) => t.id === sel.id) : undefined;
  const selEvent = sel?.kind === "e" ? events.find((e) => e.id === sel.id) : undefined;
  const setF = (k: keyof typeof filters, v: string | boolean) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <>
      <ViewHead
        eyebrow="Calendar"
        title="Reservations and events"
        actions={
          <button type="button" className="btn" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            {adding ? "Cancel" : "Add event"}
          </button>
        }
      />
      {adding ? (
        <AddEventForm
          defaultDate={date}
          onDone={() => {
            setAdding(false);
            say("Event added");
          }}
        />
      ) : null}

      <div className="calbar">
        <button type="button" className="btn small" onClick={() => go(view, today)}>
          Today
        </button>
        <button type="button" className="btn small" onClick={() => step(-1)} aria-label="Previous">
          ‹
        </button>
        <button type="button" className="btn small" onClick={() => step(1)} aria-label="Next">
          ›
        </button>
        <div className="title" aria-live="polite">
          {title}
          {navPending ? (
            <span className="muted" style={{ fontSize: 12, fontWeight: 500, marginLeft: 8 }}>
              Loading…
            </span>
          ) : null}
        </div>
        <div className="spacer" />
        <div className="subtabs" style={{ margin: 0 }}>
          {(["month", "week", "day"] as const).map((v) => (
            <button key={v} type="button" className="subtab" aria-pressed={view === v} onClick={() => go(v, date)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="calfilters">
        <select aria-label="Driver" value={filters.driver} onChange={(e) => setF("driver", e.target.value)}>
          <option value="">All drivers</option>
          <option value="_none">Unassigned</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select aria-label="Vehicle type" value={filters.vtype} onChange={(e) => setF("vtype", e.target.value)}>
          <option value="">All vehicle types</option>
          {vehicleTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select aria-label="Billing contact" value={filters.account} onChange={(e) => setF("account", e.target.value)}>
          <option value="">All billing contacts</option>
          {accounts.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select aria-label="Service type" value={filters.service} onChange={(e) => setF("service", e.target.value)}>
          <option value="">All service types</option>
          {Object.entries(SERVICE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={filters.status} onChange={(e) => setF("status", e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {groups.length ? (
          <select aria-label="Group" value={filters.group} onChange={(e) => setF("group", e.target.value)}>
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        ) : null}
        <label className="chk">
          <input type="checkbox" checked={filters.events} onChange={(e) => setF("events", e.target.checked)} />{" "}
          Non-reservation events
        </label>
      </div>

      <div className="legend">
        {statuses.map((s) => (
          <span key={s.id}>
            <i
              style={
                s.color ? { background: s.color } : { background: "var(--surface)", border: "1px solid var(--line)" }
              }
            />
            {s.name}
          </span>
        ))}
        <span>
          <i style={{ background: "var(--surface-2)", border: "1px dashed var(--line)" }} />
          Event
        </span>
      </div>

      <div style={{ opacity: navPending ? 0.6 : 1 }}>{body}</div>

      {selTrip ? (
        <TripDetail t={selTrip} statuses={statuses} statusOf={statusOf} fmtDay={fmtDay} onSaved={say} />
      ) : null}
      {selEvent ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="confno">
            <h2>{selEvent.kind} event</h2>
            <span className="chip plain">Non-reservation</span>
          </div>
          <dl className="kv">
            <dt>What</dt>
            <dd>{selEvent.title}</dd>
            <dt>When</dt>
            <dd>
              {fmtDay(selEvent.date)}
              {selEvent.time ? `, ${selEvent.time}` : ", all day"}
            </dd>
          </dl>
          <DeleteEvent
            id={selEvent.id}
            onDone={() => {
              setSel(null);
              say("Event removed");
            }}
          />
        </div>
      ) : null}

      {pop ? (
        <div className="calpop" ref={popRef} role="tooltip">
          <PopContent item={pop.item} statusOf={statusOf} fmtDay={fmtDay} />
        </div>
      ) : null}
      {toast ? (
        <div className="toast-msg" role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}

function PopContent({
  item,
  statusOf,
  fmtDay,
}: {
  item: Item;
  statusOf: (t: CalTrip) => TripStatus | null;
  fmtDay: (k: string) => string;
}) {
  if (item.k === "e") {
    const ev = item.e;
    return (
      <>
        <div className="stripe" style={{ "--c": "var(--muted)" } as React.CSSProperties} />
        <div className="ph">
          <b>{ev.kind} event</b>
          <span className="chip plain">Non-reservation</span>
        </div>
        <div className="who">{ev.title}</div>
        <dl>
          <dt>When</dt>
          <dd>
            {fmtDay(ev.date)}
            {ev.time ? `, ${ev.time}` : ", all day"}
          </dd>
        </dl>
      </>
    );
  }
  const t = item.t;
  const st = statusOf(t);
  return (
    <>
      <div className="stripe" style={{ "--c": st?.color || "var(--line)" } as React.CSSProperties} />
      <div className="ph">
        <b>#{t.conf}</b>
        <TripStatusChip status={st} />
      </div>
      <div className="who">{t.pax}</div>
      <div className="muted">{t.account}</div>
      <dl>
        <dt>When</dt>
        <dd>
          {fmtDay(t.date)}, {t.time}
          {t.hours ? ` · ${t.hours} hrs` : ""}
        </dd>
        <dt>Service</dt>
        <dd>{SERVICE_LABELS[t.service]}</dd>
        <dt>Vehicle</dt>
        <dd>{t.vehicle}</dd>
        <dt>Pickup</dt>
        <dd>{t.pickup}</dd>
        <dt>Drop-off</dt>
        <dd>{t.dropoff || "—"}</dd>
        {t.flight ? (
          <>
            <dt>Flight</dt>
            <dd>{t.flight}</dd>
          </>
        ) : null}
        {t.service === "airport_arrival" ? (
          <>
            <dt>Meet</dt>
            <dd>{MEET_GREET[(t.meetGreet as MeetGreet) || "none"]?.label}</dd>
          </>
        ) : null}
        <dt>Chauffeur</dt>
        <dd>{t.driver ?? <span className="chip crit">Unassigned</span>}</dd>
        <dt>Total</dt>
        <dd className="mono">{money(t.total)}</dd>
      </dl>
      {t.notes ? <div className="hint">{t.notes}</div> : null}
      <div className="hint">Click to open</div>
    </>
  );
}

function TripDetail({
  t,
  statuses,
  statusOf,
  fmtDay,
  onSaved,
}: {
  t: CalTrip;
  statuses: TripStatus[];
  statusOf: (t: CalTrip) => TripStatus | null;
  fmtDay: (k: string) => string;
  onSaved: (m: string) => void;
}) {
  const [pending, start] = useTransition();
  const st = statusOf(t);
  const uid = useId();
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="confno">
        <h2>
          Reservation <span className="mono">#{t.conf}</span>
        </h2>
        <TripStatusChip status={st} />
      </div>
      <dl className="kv">
        <dt>
          <label htmlFor={`${uid}st`}>Trip status</label>
        </dt>
        <dd>
          <select
            id={`${uid}st`}
            className="select-sm"
            style={{ width: "auto" }}
            value={st?.id ?? ""}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              const name = statuses.find((s) => s.id === v)?.name ?? "";
              start(async () => {
                await setTripStatus(t.id, v);
                onSaved(`#${t.conf}: ${name}`);
              });
            }}
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </dd>
        <dt>When</dt>
        <dd>
          {fmtDay(t.date)}, {t.time}
        </dd>
        <dt>Passenger</dt>
        <dd>{t.pax}</dd>
        <dt>Billing contact</dt>
        <dd>{t.account}</dd>
        <dt>Service</dt>
        <dd>
          {SERVICE_LABELS[t.service]} · {t.vehicle}
          {t.hours ? `, ${t.hours} hrs` : ""}
        </dd>
        <dt>Route</dt>
        <dd>
          {t.pickup} → {t.dropoff || "—"}
        </dd>
        <dt>Chauffeur</dt>
        <dd>{t.driver ?? "Unassigned"}</dd>
        <dt>Reservation</dt>
        <dd>{STATUS_LABELS[t.status]}</dd>
        <dt>Total</dt>
        <dd className="mono">{money(t.total)}</dd>
      </dl>
      <div className="actions">
        <Link className="btn small" href={`/dispatch?date=${t.date}&sel=${t.id}`}>
          Open in Dispatch
        </Link>
        <Link className="btn small" href={`/reservations/${t.id}`}>
          Edit reservation
        </Link>
      </div>
    </div>
  );
}

function AddEventForm({ defaultDate, onDone }: { defaultDate: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCalendarEvent, {});
  const uid = useId();
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (state.ok) done.current();
  }, [state]);
  return (
    <form className="calform" action={action}>
      <input
        type="text"
        name="title"
        placeholder="Event, e.g. Escalade #1 service"
        aria-label="Event title"
        autoFocus
      />
      <input type="date" name="date" defaultValue={defaultDate} aria-label="Event date" />
      <input type="time" name="time" defaultValue="09:00" aria-label="Event time (leave empty for all day)" />
      <select name="kind" aria-label="Event kind" id={`${uid}k`} className="select-sm" style={{ width: "auto" }}>
        <option value="Note">Note</option>
        <option value="Vehicle">Vehicle</option>
        <option value="Driver">Driver</option>
      </select>
      <button className="btn primary small" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save event"}
      </button>
      {state.error ? (
        <span className="ferr" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function DeleteEvent({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className="actions">
      <button
        type="button"
        className="btn small"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await deleteCalendarEvent(id);
            onDone();
          })
        }
      >
        Remove event
      </button>
    </div>
  );
}
