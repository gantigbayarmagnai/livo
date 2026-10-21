"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { suggestRate, type FormState } from "@/app/actions";
import type { Reservation, ReservationStatus, ServiceType } from "@/db/schema";
import { FreshAfterSubmit, useMarkSubmitted } from "./fresh-after-submit";
import { SERVICE_LABELS, STATUS_FLOW, STATUS_LABELS, money } from "@/lib/labels";

type Opts = {
  accounts: { id: string; firstName: string; lastName: string; company: string | null; phone: string | null }[];
  drivers: { id: string; firstName: string; lastName: string; status: string }[];
  vehicles: { id: string; name: string; typeName: string; vehicleTypeId: string; active: boolean }[];
  vehicleTypes: { id: string; name: string; capacity: number }[];
};

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: Partial<Reservation>;
  pickupLocal: string;
  options: Opts;
  submitLabel: string;
};

export function ReservationForm(props: Props) {
  return (
    <FreshAfterSubmit>
      <Form {...props} />
    </FreshAfterSubmit>
  );
}

function Form({ action, initial, pickupLocal, options, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const uid = useId();
  const fid = (k: string) => `${uid}${k}`;
  const markSubmitted = useMarkSubmitted();
  useEffect(() => {
    if (state.error) markSubmitted(false);
  }, [state, markSubmitted]);
  const [service, setService] = useState<ServiceType>(initial?.serviceType ?? "point_to_point");
  const [typeId, setTypeId] = useState(initial?.vehicleTypeId ?? "");
  const [duration, setDuration] = useState(initial?.estDurationMin ?? 60);
  const [rate, setRate] = useState({
    baseRate: initial?.baseRate ?? "0.00",
    gratuityPct: initial?.gratuityPct ?? "20",
    extras: initial?.extras ?? "0.00",
  });
  const [rateNote, setRateNote] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();
  const [passenger, setPassenger] = useState({
    name: initial?.passengerName ?? "",
    phone: initial?.passengerPhone ?? "",
  });

  // Field errors clear as soon as the dispatcher edits that field.
  const [edited, setEdited] = useState<{ for: FormState; names: Set<string> }>({ for: state, names: new Set() });
  const editedNow = edited.for === state ? edited.names : new Set<string>();
  const err = (k: string) => (editedNow.has(k) ? undefined : state.fieldErrors?.[k]);
  const inv = (k: string) => (err(k) ? { "aria-invalid": true as const, "aria-describedby": fid(`${k}-err`) } : {});
  const errMsg = (k: string) =>
    err(k) ? (
      <p id={fid(`${k}-err`)} className="mt-1 text-[13px] font-semibold text-stop">
        {err(k)}
      </p>
    ) : null;

  const base = Number(rate.baseRate) || 0;
  const total = base + (base * (Number(rate.gratuityPct) || 0)) / 100 + (Number(rate.extras) || 0);
  const isAirport = service === "airport_arrival" || service === "airport_departure";
  const vehicles = options.vehicles.filter((v) => v.active && (!typeId || v.vehicleTypeId === typeId));

  return (
    <form
      action={formAction}
      onSubmit={() => markSubmitted(true)}
      onInput={(e) => {
        const name = (e.target as HTMLInputElement).name;
        if (name && state.fieldErrors?.[name] && !editedNow.has(name))
          setEdited({ for: state, names: new Set(editedNow).add(name) });
      }}
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="space-y-5">
        {state.error ? (
          <p role="alert" className="rounded-md border border-stop/40 bg-stop-wash px-4 py-2.5 font-semibold text-stop">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p
            role="status"
            className="rounded-md border border-route/30 bg-route-wash px-4 py-2.5 font-semibold text-route-ink"
          >
            Changes saved.
          </p>
        ) : null}

        <Section title="Customer">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor={fid("accountId")}>
                Billing account
              </label>
              <select
                id={fid("accountId")}
                name="accountId"
                className="field"
                defaultValue={initial?.accountId ?? ""}
                onChange={(e) => {
                  const a = options.accounts.find((x) => x.id === e.target.value);
                  if (a && !passenger.name)
                    setPassenger({ name: `${a.firstName} ${a.lastName}`, phone: a.phone ?? "" });
                }}
              >
                <option value="">Walk-in / no account</option>
                {options.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.lastName}, {a.firstName}
                    {a.company ? ` — ${a.company}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={fid("passengerName")}>
                Passenger name
              </label>
              <input
                id={fid("passengerName")}
                name="passengerName"
                className="field"
                value={passenger.name}
                onChange={(e) => setPassenger({ ...passenger, name: e.target.value })}
                {...inv("passengerName")}
              />
              {errMsg("passengerName")}
            </div>
            <div>
              <label className="label" htmlFor={fid("passengerPhone")}>
                Passenger phone
              </label>
              <input
                id={fid("passengerPhone")}
                name="passengerPhone"
                type="tel"
                className="field"
                value={passenger.phone}
                onChange={(e) => setPassenger({ ...passenger, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor={fid("passengerCount")}>
                Passengers
              </label>
              <input
                id={fid("passengerCount")}
                name="passengerCount"
                type="number"
                min={1}
                className="field"
                defaultValue={initial?.passengerCount ?? 1}
                {...inv("passengerCount")}
              />
              {errMsg("passengerCount")}
            </div>
            <div>
              <label className="label" htmlFor={fid("luggageCount")}>
                Bags
              </label>
              <input
                id={fid("luggageCount")}
                name="luggageCount"
                type="number"
                min={0}
                className="field"
                defaultValue={initial?.luggageCount ?? 0}
              />
            </div>
          </div>
        </Section>

        <Section title="Trip">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={fid("serviceType")}>
                Service type
              </label>
              <select
                id={fid("serviceType")}
                name="serviceType"
                className="field"
                value={service}
                onChange={(e) => setService(e.target.value as ServiceType)}
              >
                {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={fid("pickupAt")}>
                Pickup date & time
              </label>
              <input
                id={fid("pickupAt")}
                name="pickupAt"
                type="datetime-local"
                step={300}
                className="field"
                defaultValue={pickupLocal}
                {...inv("pickupAt")}
              />
              {errMsg("pickupAt")}
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor={fid("pickupAddress")}>
                Pickup
              </label>
              <input
                id={fid("pickupAddress")}
                name="pickupAddress"
                className="field"
                defaultValue={initial?.pickupAddress ?? ""}
                placeholder="Address, venue or airport"
                {...inv("pickupAddress")}
              />
              {errMsg("pickupAddress")}
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor={fid("stops")}>
                Stops along the way <span className="font-normal text-ink-3">(one per line)</span>
              </label>
              <textarea
                id={fid("stops")}
                name="stops"
                rows={2}
                className="field"
                defaultValue={(initial?.stops ?? []).join("\n")}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor={fid("dropoffAddress")}>
                Drop-off
              </label>
              <input
                id={fid("dropoffAddress")}
                name="dropoffAddress"
                className="field"
                defaultValue={initial?.dropoffAddress ?? ""}
                placeholder={service === "hourly" ? "As directed" : "Address, venue or airport"}
              />
            </div>
            {isAirport ? (
              <>
                <div>
                  <label className="label" htmlFor={fid("airline")}>
                    Airline
                  </label>
                  <input id={fid("airline")} name="airline" className="field" defaultValue={initial?.airline ?? ""} />
                </div>
                <div>
                  <label className="label" htmlFor={fid("flightNumber")}>
                    Flight number
                  </label>
                  <input
                    id={fid("flightNumber")}
                    name="flightNumber"
                    className="field"
                    defaultValue={initial?.flightNumber ?? ""}
                  />
                </div>
              </>
            ) : (
              <>
                <input type="hidden" name="airline" value="" />
                <input type="hidden" name="flightNumber" value="" />
              </>
            )}
            <div>
              <label className="label" htmlFor={fid("estDurationMin")}>
                Estimated length <span className="font-normal text-ink-3">(minutes)</span>
              </label>
              <input
                id={fid("estDurationMin")}
                name="estDurationMin"
                type="number"
                min={15}
                step={15}
                className="field"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                {...inv("estDurationMin")}
              />
              {errMsg("estDurationMin")}
            </div>
          </div>
        </Section>

        <Section title="Notes">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={fid("customerNotes")}>
                For the chauffeur <span className="font-normal text-ink-3">(shown on trip sheet)</span>
              </label>
              <textarea
                id={fid("customerNotes")}
                name="customerNotes"
                rows={3}
                className="field"
                defaultValue={initial?.customerNotes ?? ""}
              />
            </div>
            <div>
              <label className="label" htmlFor={fid("dispatchNotes")}>
                Internal dispatch notes
              </label>
              <textarea
                id={fid("dispatchNotes")}
                name="dispatchNotes"
                rows={3}
                className="field"
                defaultValue={initial?.dispatchNotes ?? ""}
              />
            </div>
          </div>
        </Section>
      </div>

      <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
        <Section title="Assignment">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor={fid("status")}>
                Status
              </label>
              <select
                id={fid("status")}
                name="status"
                className="field"
                defaultValue={initial?.status ?? ("unassigned" satisfies ReservationStatus)}
              >
                {STATUS_FLOW.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={fid("vehicleTypeId")}>
                Vehicle type
              </label>
              <select
                id={fid("vehicleTypeId")}
                name="vehicleTypeId"
                className="field"
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
              >
                <option value="">Any</option>
                {options.vehicleTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · seats {t.capacity}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={fid("driverId")}>
                Driver
              </label>
              <select id={fid("driverId")} name="driverId" className="field" defaultValue={initial?.driverId ?? ""}>
                <option value="">Not assigned yet</option>
                {options.drivers
                  .filter((d) => d.status === "active" || d.id === initial?.driverId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.firstName} {d.lastName}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={fid("vehicleId")}>
                Vehicle
              </label>
              <select id={fid("vehicleId")} name="vehicleId" className="field" defaultValue={initial?.vehicleId ?? ""}>
                <option value="">Not assigned yet</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.typeName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        <Section
          title="Rate"
          action={
            <button
              type="button"
              className="text-[14px] font-semibold text-route hover:underline disabled:text-ink-3 disabled:no-underline"
              disabled={!typeId || looking}
              title={typeId ? undefined : "Choose a vehicle type first"}
              onClick={() =>
                startLookup(async () => {
                  const s = await suggestRate(typeId, service, duration);
                  if (s) {
                    setRate((r) => ({ ...r, baseRate: s.baseRate }));
                    setRateNote(s.note);
                  }
                })
              }
            >
              {looking ? "Looking up…" : "Use rate card"}
            </button>
          }
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="label" htmlFor={fid("baseRate")}>
                Base rate ($)
              </label>
              <input
                id={fid("baseRate")}
                name="baseRate"
                type="number"
                min={0}
                step="0.01"
                className="field"
                value={rate.baseRate}
                onChange={(e) => setRate({ ...rate, baseRate: e.target.value })}
                {...inv("baseRate")}
              />
              {rateNote ? <p className="mt-1 text-[13px] text-ink-3">{rateNote}</p> : null}
            </div>
            <div className="col-span-1">
              <label className="label" htmlFor={fid("gratuityPct")}>
                Gratuity %
              </label>
              <input
                id={fid("gratuityPct")}
                name="gratuityPct"
                type="number"
                min={0}
                max={100}
                step="0.5"
                className="field"
                value={rate.gratuityPct}
                onChange={(e) => setRate({ ...rate, gratuityPct: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor={fid("extras")}>
                Tolls, parking, extras ($)
              </label>
              <input
                id={fid("extras")}
                name="extras"
                type="number"
                min={0}
                step="0.01"
                className="field"
                value={rate.extras}
                onChange={(e) => setRate({ ...rate, extras: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-ink-2">Total</span>
            <span className="font-cond text-[26px] font-bold">{money(total)}</span>
          </div>
        </Section>

        <button type="submit" className="btn btn-primary w-full justify-center py-2.5 text-[15px]" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <legend className="float-left font-semibold">{title}</legend>
        {action}
      </div>
      <div className="clear-both p-4">{children}</div>
    </fieldset>
  );
}
