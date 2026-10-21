import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DriverDot, Empty, LoadingRows, PageHeader, StatusBadge } from "@/components/ui";
import type { ReservationStatus } from "@/db/schema";
import { SERVICE_LABELS, STATUS_FLOW, STATUS_LABELS, fullName, money, reservationTotal } from "@/lib/labels";
import { listReservations } from "@/lib/queries";
import { addDays, formatDate, formatTime, isDateKey, todayKey, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Reservations" };

type Search = { from?: string; to?: string; status?: string; q?: string };

export default function ReservationsPage({ searchParams }: PageProps<"/reservations">) {
  return (
    <>
      <PageHeader
        title="Reservations"
        actions={
          <Link href="/reservations/new" className="btn btn-primary">
            New reservation
          </Link>
        }
      />
      <Suspense fallback={<LoadingRows rows={10} />}>
        <List searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

async function List({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const sp = await searchParams;
  const today = todayKey();
  const from = isDateKey(sp.from) ? sp.from : today;
  const to = isDateKey(sp.to) ? sp.to : addDays(from, 13);
  const status = STATUS_FLOW.includes(sp.status as ReservationStatus) ? (sp.status as ReservationStatus) : undefined;
  const q = (sp.q ?? "").trim().slice(0, 80);

  const rows = await listReservations({
    from: zonedToUtc(from),
    to: zonedToUtc(addDays(to, 1)),
    statuses: status ? [status] : undefined,
    search: q || undefined,
  });
  const billable = rows.filter((x) => x.r.status !== "cancelled" && x.r.status !== "quote");
  const revenue = billable.reduce((s, x) => s + reservationTotal(x.r), 0);

  // Group by company-time day.
  const groups = new Map<string, typeof rows>();
  for (const x of rows) {
    const k = formatDate(x.r.pickupAt);
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }

  return (
    <div className="space-y-4 px-4 py-5 md:px-8">
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-3" role="search">
        <label className="block min-w-[220px] flex-1">
          <span className="label">Search</span>
          <input
            name="q"
            className="field"
            defaultValue={q}
            placeholder="Conf #, passenger, company, address, flight"
          />
        </label>
        <label className="block">
          <span className="label">From</span>
          <input name="from" type="date" className="field" defaultValue={from} />
        </label>
        <label className="block">
          <span className="label">To</span>
          <input name="to" type="date" className="field" defaultValue={to} />
        </label>
        <label className="block">
          <span className="label">Status</span>
          <select name="status" className="field" defaultValue={status ?? ""}>
            <option value="">Any status</option>
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" type="submit">
          Show reservations
        </button>
        {q || status || sp.from || sp.to ? (
          <Link className="btn" href="/reservations">
            Clear
          </Link>
        ) : null}
      </form>

      <p className="text-ink-2">
        {rows.length} reservations · {money(revenue)} booked, excluding quotes and cancellations
      </p>

      {rows.length === 0 ? (
        <Empty>No reservations match. Widen the dates or clear the search.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[940px] border-collapse text-left">
            <thead className="border-b border-line text-[13px] text-ink-3">
              <tr>
                <th className="py-2 pl-4 font-medium">Conf #</th>
                <th className="py-2 font-medium">Time</th>
                <th className="py-2 font-medium">Passenger</th>
                <th className="py-2 font-medium">Service</th>
                <th className="py-2 font-medium">Pickup</th>
                <th className="py-2 font-medium">Driver</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 pr-4 text-right font-medium">Total</th>
              </tr>
            </thead>
            {[...groups.entries()].map(([day, list]) => (
              <tbody key={day}>
                <tr className="bg-paper">
                  <th colSpan={8} className="py-1.5 pl-4 text-left text-[13px] font-semibold text-ink-2">
                    {day} · {list.length}
                  </th>
                </tr>
                {list.map((x) => (
                  <tr key={x.r.id} className="border-b border-line hover:bg-route-wash/40">
                    <td className="py-2 pl-4">
                      <Link className="font-semibold text-route hover:underline" href={`/reservations/${x.r.id}`}>
                        {x.r.confNumber}
                      </Link>
                    </td>
                    <td className="py-2 font-cond text-[17px] font-semibold">{formatTime(x.r.pickupAt)}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{x.r.passengerName}</div>
                      {x.account?.company ? <div className="text-[13px] text-ink-3">{x.account.company}</div> : null}
                    </td>
                    <td className="py-2 pr-3 text-[14px]">
                      {SERVICE_LABELS[x.r.serviceType]}
                      <div className="text-[13px] text-ink-3">{x.vehicleType?.name ?? "Any vehicle"}</div>
                    </td>
                    <td className="max-w-[260px] truncate py-2 pr-3 text-[14px]" title={x.r.pickupAddress}>
                      {x.r.pickupAddress}
                    </td>
                    <td className="py-2 pr-3 text-[14px]">
                      {x.driver?.id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <DriverDot color={x.driver.color} />
                          {fullName(x.driver)}
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={x.r.status} />
                    </td>
                    <td className="py-2 pr-4 text-right">{money(reservationTotal(x.r))}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}
