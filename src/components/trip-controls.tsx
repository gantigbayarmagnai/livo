"use client";

import { useTransition } from "react";
import { assignDriver, assignVehicle, setTripStatus } from "@/app/actions";
import type { ReservationStatus } from "@/db/schema";
import { STATUS_FLOW, STATUS_LABELS, STATUS_STYLES } from "@/lib/labels";

type Opt = { id: string; label: string; muted?: boolean };

const compact =
  "w-full min-w-0 rounded-md border border-line-strong bg-surface px-2 py-1 text-[14px] focus:border-route focus:outline-none focus:ring-2 focus:ring-route-wash disabled:opacity-60";

export function StatusSelect({ id, status, label }: { id: string; status: ReservationStatus; label: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`Status for ${label}`}
      className={`${compact} font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}
      value={status}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value as ReservationStatus;
        start(() => setTripStatus(id, v));
      }}
    >
      {STATUS_FLOW.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

export function DriverSelect({
  id,
  driverId,
  options,
  label,
}: {
  id: string;
  driverId: string | null;
  options: Opt[];
  label: string;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`Driver for ${label}`}
      className={`${compact} ${driverId ? "" : "border-signal bg-signal-wash text-signal"}`}
      value={driverId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value || null;
        start(() => assignDriver(id, v));
      }}
    >
      <option value="">Needs driver</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
          {o.muted ? " (off shift)" : ""}
        </option>
      ))}
    </select>
  );
}

export function VehicleSelect({
  id,
  vehicleId,
  options,
  label,
}: {
  id: string;
  vehicleId: string | null;
  options: Opt[];
  label: string;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`Vehicle for ${label}`}
      className={compact}
      value={vehicleId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value || null;
        start(() => assignVehicle(id, v));
      }}
    >
      <option value="">No vehicle</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
