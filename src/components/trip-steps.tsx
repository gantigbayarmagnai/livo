"use client";

import { useState, useTransition } from "react";
import { updateMyTrip } from "@/app/auth-actions";
import type { ReservationStatus } from "@/db/schema";

const NEXT: Partial<Record<ReservationStatus, { to: ReservationStatus; label: string }>> = {
  assigned: { to: "en_route", label: "On my way" },
  unassigned: { to: "en_route", label: "On my way" },
  en_route: { to: "on_location", label: "On location" },
  on_location: { to: "passenger_on_board", label: "Passenger on board" },
  passenger_on_board: { to: "done", label: "Trip done" },
};

/** One big button for the next step, so it's easy to hit from the driver's seat. */
export function TripSteps({ id, status }: { id: string; status: ReservationStatus }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = NEXT[status];
  if (!next) return null;
  return (
    <div className="steps">
      <button
        type="button"
        className="btn primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await updateMyTrip(id, next.to);
            setError(r.error ?? null);
          })
        }
      >
        {pending ? "Saving…" : next.label}
      </button>
      {error ? (
        <p role="alert" className="errbox" style={{ margin: 0, gridColumn: "1 / -1" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
