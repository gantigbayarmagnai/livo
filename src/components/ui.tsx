import type { ReactNode } from "react";
import type { ReservationStatus } from "@/db/schema";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/labels";

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-surface px-4 py-4 md:px-8">
      <div className="min-w-0">
        <h1 className="font-cond text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        {sub ? <div className="mt-0.5 text-ink-2">{sub}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[13px] font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function DriverDot({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />;
}

export function Panel({ title, children, actions }: { title?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      {title ? (
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="font-semibold">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-10 text-center text-ink-2">
      {children}
    </div>
  );
}

export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4 md:px-8" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-md bg-line/60" />
      ))}
    </div>
  );
}
