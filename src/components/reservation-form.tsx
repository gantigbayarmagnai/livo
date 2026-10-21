"use client";

import { useActionState, useEffect, useId, useState } from "react";
import type { FormState } from "@/app/actions";
import type { Reservation, ReservationStatus, ServiceType, TripStatus } from "@/db/schema";
import { SERVICE_LABELS, STATUS_FLOW, STATUS_LABELS } from "@/lib/labels";
import { MEET_GREET, quote, type MeetGreet, type RateType } from "@/lib/pricing";
import { FreshAfterSubmit, useMarkSubmitted } from "./fresh-after-submit";

type Opts = {
  accounts: { id: string; firstName: string; lastName: string; company: string | null; phone: string | null }[];
  drivers: { id: string; firstName: string; lastName: string; status: string }[];
  vehicles: { id: string; name: string; typeName: string; vehicleTypeId: string; active: boolean }[];
  vehicleTypes: (RateType & { id: string })[];
  tripStatuses: TripStatus[];
};

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: Partial<Reservation>;
  pickupDate: string;
  pickupTime: string;
  confNumber: number;
  isNew: boolean;
  options: Opts;
  /** Staff price / tolls recovered from a saved reservation. */
  initialStaffPrice?: number;
  initialTolls?: number;
};

export function ReservationForm(props: Props) {
  return (
    <FreshAfterSubmit>
      <Form {...props} />
    </FreshAfterSubmit>
  );
}

const SERVICE_ORDER: ServiceType[] = ["airport_arrival", "hourly", "airport_departure", "point_to_point", "round_trip"];
const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function Form({
  action,
  initial,
  pickupDate,
  pickupTime,
  confNumber,
  isNew,
  options,
  initialStaffPrice = 0,
  initialTolls = 0,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const uid = useId();
  const id = (k: string) => `${uid}${k}`;
  const markSubmitted = useMarkSubmitted();
  useEffect(() => {
    if (state.error) markSubmitted(false);
  }, [state, markSubmitted]);

  // Everything the live quote depends on is controlled.
  const [service, setService] = useState<ServiceType>(initial?.serviceType ?? "airport_arrival");
  const [typeId, setTypeId] = useState(initial?.vehicleTypeId ?? options.vehicleTypes[0]?.id ?? "");
  const [date, setDate] = useState(pickupDate);
  const [time, setTime] = useState(pickupTime);
  const [hours, setHours] = useState(
    initial?.serviceType === "hourly" && initial.estDurationMin ? initial.estDurationMin / 60 : 3,
  );
  const [outsideSf, setOutsideSf] = useState(initial?.outsideSf ?? false);
  const [mg, setMg] = useState<MeetGreet>((initial?.meetGreet as MeetGreet) ?? "none");
  const [staffPrice, setStaffPrice] = useState(initialStaffPrice ? String(initialStaffPrice) : "");
  const [tolls, setTolls] = useState(initialTolls ? String(initialTolls) : "");
  const [passenger, setPassenger] = useState({
    name: initial?.passengerName ?? "",
    phone: initial?.passengerPhone ?? "",
  });
  const [dropoff, setDropoff] = useState(initial?.dropoffAddress ?? "");
  const [flight, setFlight] = useState(initial?.flightNumber ?? "");

  // Field errors clear as soon as that field is edited.
  const [edited, setEdited] = useState<{ for: FormState; names: Set<string> }>({ for: state, names: new Set() });
  const editedNow = edited.for === state ? edited.names : new Set<string>();
  const err = (k: string) => (editedNow.has(k) ? undefined : state.fieldErrors?.[k]);
  const inv = (k: string) => (err(k) ? { "aria-invalid": true as const, "aria-describedby": id(`${k}-err`) } : {});
  const errMsg = (k: string) =>
    err(k) ? (
      <span id={id(`${k}-err`)} className="ferr">
        {err(k)}
      </span>
    ) : null;

  const type = options.vehicleTypes.find((t) => t.id === typeId) ?? null;
  const q = quote({
    service,
    type,
    hours,
    outsideSf,
    meetGreet: mg,
    pickupTime: time,
    staffPrice: Number(staffPrice) || 0,
    tolls: Number(tolls) || 0,
  });
  const missing: string[] = [];
  if (!passenger.name.trim()) missing.push("passenger");
  if (!date) missing.push("date");
  if (!dropoff.trim() && service !== "hourly") missing.push("drop-off");
  if (service === "airport_arrival" && !flight.trim()) missing.push("flight");
  const needsStaffPrice = !!q.staff || !["airport_arrival", "hourly"].includes(service);

  return (
    <form
      action={formAction}
      onSubmit={() => markSubmitted(true)}
      onInput={(e) => {
        const name = (e.target as HTMLInputElement).name;
        if (name && state.fieldErrors?.[name] && !editedNow.has(name))
          setEdited({ for: state, names: new Set(editedNow).add(name) });
      }}
      className="book"
      noValidate
    >
      <div className="panel form">
        <div className="field">
          <label htmlFor={id("accountId")}>Billing account</label>
          <select
            id={id("accountId")}
            name="accountId"
            defaultValue={initial?.accountId ?? ""}
            onChange={(e) => {
              const a = options.accounts.find((x) => x.id === e.target.value);
              if (a && !passenger.name)
                setPassenger({ name: a.company ? "" : `${a.firstName} ${a.lastName}`, phone: a.phone ?? "" });
            }}
          >
            <option value="">Walk-in / no account</option>
            {options.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company ?? `${a.lastName}, ${a.firstName}`}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id("passengerName")}>Passenger</label>
          <input
            id={id("passengerName")}
            name="passengerName"
            placeholder="Name"
            value={passenger.name}
            onChange={(e) => setPassenger({ ...passenger, name: e.target.value })}
            {...inv("passengerName")}
          />
          {errMsg("passengerName")}
        </div>
        <div className="field">
          <label htmlFor={id("passengerPhone")}>Passenger phone</label>
          <input
            id={id("passengerPhone")}
            name="passengerPhone"
            type="tel"
            value={passenger.phone}
            onChange={(e) => setPassenger({ ...passenger, phone: e.target.value })}
          />
        </div>
        <div className="field" style={{ flexDirection: "row", gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor={id("passengerCount")}>Passengers</label>
            <input
              id={id("passengerCount")}
              name="passengerCount"
              type="number"
              min={1}
              defaultValue={initial?.passengerCount ?? 1}
              {...inv("passengerCount")}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor={id("luggageCount")}>Bags</label>
            <input
              id={id("luggageCount")}
              name="luggageCount"
              type="number"
              min={0}
              defaultValue={initial?.luggageCount ?? 0}
            />
          </div>
        </div>

        <div className="field full" role="radiogroup" aria-labelledby={id("svc")}>
          <span className="flabel" id={id("svc")}>
            Service type
          </span>
          <div className="seg">
            {SERVICE_ORDER.map((s) => (
              <label key={s}>
                <input
                  type="radio"
                  name="serviceType"
                  value={s}
                  checked={service === s}
                  onChange={() => setService(s)}
                />{" "}
                {s === "airport_arrival" ? "SFO pickup to San Francisco" : SERVICE_LABELS[s]}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor={id("pickupDate")}>Pickup date</label>
          <input
            id={id("pickupDate")}
            name="pickupDate"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            {...inv("pickupDate")}
          />
          {errMsg("pickupDate")}
        </div>
        <div className="field">
          <label htmlFor={id("pickupTime")}>Pickup time</label>
          <input
            id={id("pickupTime")}
            name="pickupTime"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            {...inv("pickupTime")}
          />
          {errMsg("pickupTime")}
        </div>

        <div className="field full">
          <label htmlFor={id("vehicleTypeId")}>Vehicle type</label>
          <select
            id={id("vehicleTypeId")}
            name="vehicleTypeId"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
          >
            {options.vehicleTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.capacity} seats
              </option>
            ))}
          </select>
        </div>

        {service === "hourly" ? (
          <>
            <div className="field">
              <label htmlFor={id("hours")}>Hours requested</label>
              <input
                id={id("hours")}
                name="hours"
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor={id("outsideSf")}>City</label>
              <select
                id={id("outsideSf")}
                value={outsideSf ? "other" : "sf"}
                onChange={(e) => setOutsideSf(e.target.value === "other")}
              >
                <option value="sf">San Francisco</option>
                <option value="other">Other city</option>
              </select>
              <input type="hidden" name="outsideSf" value={outsideSf ? "true" : "false"} />
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="hours" value="0" />
            <input type="hidden" name="outsideSf" value="false" />
          </>
        )}

        {service === "airport_arrival" ? (
          <>
            <div className="field full">
              <label htmlFor={id("flightNumber")}>Flight</label>
              <input
                id={id("flightNumber")}
                name="flightNumber"
                placeholder="e.g. UA 1712 from ORD"
                value={flight}
                onChange={(e) => setFlight(e.target.value)}
              />
            </div>
            <div className="field full" role="radiogroup" aria-labelledby={id("mg")}>
              <span className="flabel" id={id("mg")}>
                Meet &amp; Greet
              </span>
              <div className="seg">
                {(Object.keys(MEET_GREET) as MeetGreet[]).map((k) => (
                  <label key={k}>
                    <input type="radio" name="meetGreet" value={k} checked={mg === k} onChange={() => setMg(k)} />{" "}
                    {k === "none"
                      ? "Curbside (included)"
                      : k === "driver"
                        ? "Driver at bag claim +$50"
                        : "Separate greeter +$100"}
                  </label>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="meetGreet" value="none" />
            {service === "airport_departure" ? (
              <div className="field full">
                <label htmlFor={id("flightNumber")}>Flight</label>
                <input
                  id={id("flightNumber")}
                  name="flightNumber"
                  placeholder="Optional"
                  value={flight}
                  onChange={(e) => setFlight(e.target.value)}
                />
              </div>
            ) : (
              <input type="hidden" name="flightNumber" value="" />
            )}
          </>
        )}

        <div className="field">
          <label htmlFor={id("pickupAddress")}>Pickup</label>
          <input
            id={id("pickupAddress")}
            name="pickupAddress"
            defaultValue={initial?.pickupAddress ?? (isNew ? "SFO, San Francisco International" : "")}
            {...inv("pickupAddress")}
          />
          {errMsg("pickupAddress")}
        </div>
        <div className="field">
          <label htmlFor={id("dropoffAddress")}>Drop-off</label>
          <input
            id={id("dropoffAddress")}
            name="dropoffAddress"
            placeholder={service === "hourly" ? "As directed" : "Address or hotel"}
            value={dropoff}
            onChange={(e) => setDropoff(e.target.value)}
          />
        </div>
        <div className="field full">
          <label htmlFor={id("stops")}>Stops along the way (one per line)</label>
          <textarea id={id("stops")} name="stops" rows={2} defaultValue={(initial?.stops ?? []).join("\n")} />
        </div>

        {needsStaffPrice ? (
          <div className="field">
            <label htmlFor={id("staffPrice")}>Staff price ($)</label>
            <input
              id={id("staffPrice")}
              name="staffPrice"
              type="number"
              min={0}
              step={1}
              placeholder="Not on rate card"
              value={staffPrice}
              onChange={(e) => setStaffPrice(e.target.value)}
            />
          </div>
        ) : (
          <input type="hidden" name="staffPrice" value={staffPrice} />
        )}
        <div className="field">
          <label htmlFor={id("tolls")}>Tolls and parking ($)</label>
          <input
            id={id("tolls")}
            name="tolls"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={tolls}
            onChange={(e) => setTolls(e.target.value)}
          />
        </div>
        <input
          type="hidden"
          name="estDurationMin"
          value={initial?.serviceType !== "hourly" && initial?.estDurationMin ? initial.estDurationMin : 90}
        />

        <div className="field full">
          <label htmlFor={id("customerNotes")}>Trip notes (on the chauffeur brief)</label>
          <textarea
            id={id("customerNotes")}
            name="customerNotes"
            rows={2}
            placeholder="Name sign, child seat, special requests"
            defaultValue={initial?.customerNotes ?? ""}
          />
        </div>
        <div className="field full">
          <label htmlFor={id("dispatchNotes")}>Internal dispatch notes</label>
          <textarea
            id={id("dispatchNotes")}
            name="dispatchNotes"
            rows={2}
            defaultValue={initial?.dispatchNotes ?? ""}
          />
        </div>

        <div className="formsec">
          <h2>Dispatch</h2>
        </div>
        <div className="field">
          <label htmlFor={id("tripStatusId")}>Trip status</label>
          <select id={id("tripStatusId")} name="tripStatusId" defaultValue={initial?.tripStatusId ?? ""}>
            <option value="">Set automatically</option>
            {options.tripStatuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id("status")}>Progress</label>
          <select
            id={id("status")}
            name="status"
            defaultValue={initial?.status ?? ("unassigned" satisfies ReservationStatus)}
          >
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id("driverId")}>Chauffeur</label>
          <select id={id("driverId")} name="driverId" defaultValue={initial?.driverId ?? ""}>
            <option value="">Unassigned</option>
            {options.drivers
              .filter((d) => d.status === "active" || d.id === initial?.driverId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName}
                </option>
              ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id("vehicleId")}>Vehicle</label>
          <select id={id("vehicleId")} name="vehicleId" defaultValue={initial?.vehicleId ?? ""}>
            <option value="">Not assigned yet</option>
            {options.vehicles
              .filter((v) => v.active && (!typeId || v.vehicleTypeId === typeId || v.id === initial?.vehicleId))
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.typeName}
                </option>
              ))}
          </select>
        </div>
        <div className="field full">
          <label htmlFor={id("groupName")}>Group</label>
          <input
            id={id("groupName")}
            name="groupName"
            placeholder="Optional, e.g. Northwind roadshow"
            defaultValue={initial?.groupName ?? ""}
          />
        </div>
      </div>

      <aside className="panel quote" aria-live="polite">
        <div className="confno">
          <div>
            <div className="eyebrow">Confirmation</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
              #{confNumber}
            </div>
          </div>
          {isNew ? <span className="chip info">Continues your Limo Anywhere numbers</span> : null}
        </div>
        {state.error ? (
          <p role="alert" className="errbox" style={{ margin: "0 0 10px" }}>
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p role="status" className="okbox" style={{ margin: "0 0 10px" }}>
            Changes saved.
          </p>
        ) : null}
        {q.staff ? (
          <div className="staff">{q.staff}</div>
        ) : (
          <table className="lines">
            <tbody>
              {q.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l[0]}</td>
                  <td>{money(l[1])}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Estimated total</td>
                <td>{money(q.total)}</td>
              </tr>
            </tbody>
          </table>
        )}
        <ul className="notes">
          {q.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        {missing.length ? (
          <div className="actions" style={{ gap: 6 }}>
            {missing.map((m) => (
              <span key={m} className="chip warn">
                Add {m}
              </span>
            ))}
          </div>
        ) : null}
        <div className="actions">
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? "Saving…" : isNew ? `Save reservation #${confNumber}` : "Save changes"}
          </button>
        </div>
        {isNew && (q.staff || missing.length) ? (
          <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
            You can save now and finish the details later.
          </p>
        ) : null}
      </aside>
    </form>
  );
}
