import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DateNav } from "@/components/date-nav";
import { DriverDot, LoadingRows, PageHeader } from "@/components/ui";
import { listReservations } from "@/lib/queries";
import { addDays, formatDayKey, formatTime, isDateKey, startOfWeek, toDateKey, todayKey, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <Suspense fallback={<LoadingRows rows={8} />}>
      <Month searchParams={searchParams as Promise<{ date?: string }>} />
    </Suspense>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

async function Month({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await connection();
  const sp = await searchParams;
  const today = todayKey();
  const anchor = isDateKey(sp.date) ? sp.date : today;
  const monthKey = anchor.slice(0, 7);
  const first = `${monthKey}-01`;
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // Drop a trailing week that belongs entirely to the next month.
  const weeks = days.length / 7 - (days[35].slice(0, 7) !== monthKey ? 1 : 0);
  const shown = days.slice(0, weeks * 7);

  const rows = await listReservations({
    from: zonedToUtc(shown[0]),
    to: zonedToUtc(addDays(shown.at(-1)!, 1)),
    limit: 3000,
  });
  const byDay = new Map<string, typeof rows>();
  for (const x of rows) {
    if (x.r.status === "cancelled" || x.r.status === "no_show") continue;
    const k = toDateKey(x.r.pickupAt);
    byDay.set(k, [...(byDay.get(k) ?? []), x]);
  }

  const [y, m] = monthKey.split("-").map(Number);
  const prevMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-01`;
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;

  return (
    <>
      <PageHeader
        title={formatDayKey(first, { month: "long", year: "numeric" })}
        actions={
          <DateNav path="/calendar" date={anchor} today={today} prev={prevMonth} next={nextMonth} unit="month" />
        }
      />
      <div className="px-4 py-5 md:px-8">
        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7 overflow-hidden rounded-lg border border-line bg-line gap-px">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-paper px-2 py-1.5 text-[13px] font-semibold text-ink-2">
                {d}
              </div>
            ))}
            {shown.map((d) => {
              const trips = byDay.get(d) ?? [];
              const open = trips.filter((x) => !x.r.driverId && x.r.status !== "quote" && x.r.status !== "done").length;
              const inMonth = d.slice(0, 7) === monthKey;
              const isToday = d === today;
              return (
                <div
                  key={d}
                  className={`group relative min-h-[118px] p-2 ${inMonth ? "bg-surface" : "bg-paper text-ink-3"}`}
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/dispatch?date=${d}`}
                      className={`font-cond text-[19px] font-bold leading-none hover:underline ${isToday ? "rounded bg-route px-1.5 py-0.5 text-white" : ""}`}
                      aria-label={`Dispatch for ${formatDayKey(d)}`}
                    >
                      {Number(d.slice(8))}
                    </Link>
                    <Link
                      href={`/reservations/new?date=${d}`}
                      className="rounded px-1.5 text-[18px] leading-none text-ink-3 opacity-0 hover:bg-route-wash hover:text-route focus:opacity-100 group-hover:opacity-100"
                      aria-label={`New reservation on ${formatDayKey(d)}`}
                    >
                      +
                    </Link>
                  </div>
                  {trips.length ? (
                    <Link href={`/dispatch?date=${d}`} className="mt-1.5 block">
                      <div className="text-[13px] text-ink-2">
                        {trips.length} trip{trips.length === 1 ? "" : "s"}
                        {open ? <span className="font-semibold text-signal"> · {open} open</span> : null}
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {trips.slice(0, 3).map((x) => (
                          <li key={x.r.id} className="flex items-center gap-1.5 truncate text-[12px]">
                            <DriverDot color={x.driver?.color ?? "var(--signal)"} />
                            <span className="font-semibold">{formatTime(x.r.pickupAt)}</span>
                            <span className="truncate text-ink-2">{x.r.passengerName}</span>
                          </li>
                        ))}
                        {trips.length > 3 ? (
                          <li className="text-[12px] text-ink-3">and {trips.length - 3} more</li>
                        ) : null}
                      </ul>
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
