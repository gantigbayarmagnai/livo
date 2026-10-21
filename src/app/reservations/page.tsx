import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Loading, StatusChip, TripStatusChip, ViewHead } from "@/components/ui";
import type { ReservationStatus } from "@/db/schema";
import { ACTIVE_STATUSES, money, reservationTotal } from "@/lib/labels";
import { countReservations, listReservations } from "@/lib/queries";
import { formatDayKey, hhmm, toDateKey, todayKey, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Reservations" };

const GROUPS: { id: string; label: string; statuses?: ReservationStatus[]; upcoming?: boolean }[] = [
  { id: "live", label: "New/Live", statuses: ACTIVE_STATUSES, upcoming: true },
  { id: "quotes", label: "Quotes", statuses: ["quote"] },
  { id: "done", label: "Done", statuses: ["done"] },
  { id: "cancelled", label: "Cancelled & no-show", statuses: ["cancelled", "no_show"] },
  { id: "all", label: "All" },
];

type Search = { group?: string; q?: string };

export default function ReservationsPage({ searchParams }: PageProps<"/reservations">) {
  return (
    <Suspense
      fallback={
        <>
          <ViewHead eyebrow="Reservations" title="Company reservations" />
          <Loading rows={10} />
        </>
      }
    >
      <List searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

async function List({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const group = GROUPS.find((g) => g.id === sp.group) ?? GROUPS[0];
  const today = todayKey();

  const [rows, counts] = await Promise.all([
    listReservations({
      search: q || undefined,
      statuses: q ? undefined : group.statuses,
      from: !q && group.upcoming ? zonedToUtc(today) : undefined,
      limit: 1000,
    }),
    q
      ? Promise.resolve(null)
      : Promise.all(
          GROUPS.map((g) =>
            countReservations({ statuses: g.statuses, from: g.upcoming ? zonedToUtc(today) : undefined }),
          ),
        ),
  ]);
  const list = group.upcoming || q ? rows : [...rows].reverse();

  return (
    <>
      <ViewHead
        eyebrow="Reservations"
        title={q ? `Search: “${q}”` : "Company reservations"}
        actions={
          q ? (
            <Link className="btn" href="/reservations">
              Clear search
            </Link>
          ) : (
            <Link className="btn primary" href="/reservations/new">
              New Res/Quote
            </Link>
          )
        }
      />
      {counts ? (
        <div className="subtabs">
          {GROUPS.map((g, i) => (
            <Link
              key={g.id}
              className="subtab"
              aria-current={g.id === group.id ? "page" : undefined}
              href={`/reservations?group=${g.id}`}
            >
              {g.label} <span className="mono">{counts[i]}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Conf #</th>
              <th>Date</th>
              <th>Time</th>
              <th>Passenger</th>
              <th>Account</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th>Trip status</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {list.length ? (
              list.map(({ r, account, vehicleType, tripStatus }) => (
                <tr key={r.id} className="click">
                  <td className="mono">
                    <Link href={`/reservations/${r.id}`}>{r.confNumber}</Link>
                  </td>
                  <td>{formatDayKey(toDateKey(r.pickupAt), { weekday: "short", month: "short", day: "numeric" })}</td>
                  <td className="mono">{hhmm(r.pickupAt)}</td>
                  <td>
                    <Link href={`/reservations/${r.id}`} style={{ textDecoration: "none" }}>
                      {r.passengerName}
                    </Link>
                  </td>
                  <td>{account?.id ? (account.company ?? `${account.firstName} ${account.lastName}`) : "Walk-in"}</td>
                  <td>{vehicleType?.name ?? "—"}</td>
                  <td>
                    <StatusChip status={r.status} />
                  </td>
                  <td>
                    <TripStatusChip status={tripStatus?.id ? tripStatus : null} />
                  </td>
                  <td className="num">{Number(r.baseRate) ? money(reservationTotal(r)) : "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="muted">
                  No reservations here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
