import type { ReactNode } from "react";
import type { ReservationStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/labels";

/** Eyebrow + title + optional description and actions, as in the prototype. */
export function ViewHead({
  eyebrow,
  title,
  desc,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  desc?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="view-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {desc ? <p>{desc}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}

const LIFECYCLE_CHIP: Record<ReservationStatus, string> = {
  quote: "info",
  unassigned: "crit",
  assigned: "good",
  en_route: "good",
  on_location: "good",
  passenger_on_board: "good",
  done: "plain",
  cancelled: "plain",
  no_show: "warn",
};

export function StatusChip({ status }: { status: ReservationStatus }) {
  return <span className={`chip ${LIFECYCLE_CHIP[status]}`}>{STATUS_LABELS[status]}</span>;
}

/** MGL's own colored trip status, tinted with its color (or plain when it has none). */
export function TripStatusChip({ status }: { status: { name: string; color: string | null } | null | undefined }) {
  if (!status?.name) return <span className="chip plain">No status</span>;
  if (!status.color) return <span className="chip plain">{status.name}</span>;
  return (
    <span
      className="chip"
      style={{
        background: `color-mix(in srgb, ${status.color} 30%, var(--surface))`,
        color: "var(--ink)",
        border: `1px solid ${status.color}`,
      }}
    >
      {status.name}
    </span>
  );
}

export function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="stack" style={{ gap: 8 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

/** Sections from Limo Anywhere that Livo hasn't built yet. */
export function NotBuilt({ eyebrow, title, plan }: { eyebrow: string; title: string; plan: string[] }) {
  return (
    <>
      <ViewHead eyebrow={eyebrow} title={title} desc="Not built yet in this version of Livo. Here's what goes here." />
      <div className="panel">
        <ul className="notes" style={{ marginTop: 0, fontSize: 13.5, color: "var(--ink)" }}>
          {plan.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
