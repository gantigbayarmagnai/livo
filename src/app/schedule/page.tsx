import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { addShift, deleteShift } from "@/app/actions";
import { DateNav } from "@/components/date-nav";
import { ActionButton, InlineForm } from "@/components/resource-forms";
import { DriverDot, LoadingRows, PageHeader } from "@/components/ui";
import { fullName } from "@/lib/labels";
import { getResources, listReservations, listShifts } from "@/lib/queries";
import { addDays, formatDayKey, formatTime, isDateKey, startOfWeek, toDateKey, todayKey, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Driver schedule" };

export default function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  return (
    <Suspense fallback={<LoadingRows rows={8} />}>
      <Week searchParams={searchParams as Promise<{ date?: string }>} />
    </Suspense>
  );
}

async function Week({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await connection();
  const sp = await searchParams;
  const today = todayKey();
  const anchor = isDateKey(sp.date) ? sp.date : today;
  const monday = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const from = zonedToUtc(monday);
  const to = zonedToUtc(addDays(monday, 7));

  const [res, shifts, trips] = await Promise.all([
    getResources(),
    listShifts(from, to),
    listReservations({ from, to, limit: 2000 }),
  ]);
  const drivers = res.drivers.filter((d) => d.status === "active");
  const live = trips.filter((x) => x.r.status !== "cancelled" && x.r.status !== "no_show" && x.r.status !== "quote");

  const cell = (driverId: string, day: string) => ({
    shifts: shifts.filter((s) => s.driverId === driverId && toDateKey(s.startsAt) === day),
    trips: live.filter((x) => x.r.driverId === driverId && toDateKey(x.r.pickupAt) === day),
  });

  const weekHours = (driverId: string) =>
    shifts
      .filter((s) => s.driverId === driverId)
      .reduce((h, s) => h + (s.endsAt.getTime() - s.startsAt.getTime()) / 3_600_000, 0);

  return (
    <>
      <PageHeader
        title="Driver schedule"
        sub={`Week of ${formatDayKey(monday, { month: "long", day: "numeric", year: "numeric" })}`}
        actions={
          <DateNav
            path="/schedule"
            date={anchor}
            today={today}
            prev={addDays(monday, -7)}
            next={addDays(monday, 7)}
            unit="week"
          />
        }
      />
      <div className="space-y-5 px-4 py-5 md:px-8">
        <section className="rounded-lg border border-line bg-surface p-4" aria-labelledby="add-shift">
          <h2 id="add-shift" className="mb-3 font-semibold">
            Add a shift
          </h2>
          <InlineForm action={addShift} submitLabel="Add shift" savedLabel="Shift added.">
            <label className="block">
              <span className="label">Driver</span>
              <select name="driverId" className="field" required>
                <option value="">Choose…</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {fullName(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Date</span>
              <input name="date" type="date" className="field" defaultValue={anchor} required />
            </label>
            <label className="block">
              <span className="label">Starts</span>
              <input name="start" type="time" className="field" defaultValue="06:00" required />
            </label>
            <label className="block">
              <span className="label">Ends</span>
              <input name="end" type="time" className="field" defaultValue="16:00" required />
            </label>
            <label className="block min-w-[180px] flex-1">
              <span className="label">Note</span>
              <input name="notes" className="field" placeholder="Optional" />
            </label>
          </InlineForm>
        </section>

        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[1000px] table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="w-44 py-2 pl-4 text-[13px] font-medium text-ink-3">Driver</th>
                {days.map((d) => (
                  <th
                    key={d}
                    className={`py-2 pl-2 text-[13px] font-semibold ${d === today ? "text-route" : "text-ink-2"}`}
                  >
                    <Link href={`/dispatch?date=${d}`} className="hover:underline">
                      {formatDayKey(d, {
                        weekday: "short",
                        month: "numeric",
                        day: "numeric",
                      })}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map((drv) => (
                <tr key={drv.id} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="py-2.5 pl-4 pr-2 text-left font-normal">
                    <span className="flex items-center gap-2 font-semibold">
                      <DriverDot color={drv.color} />
                      {fullName(drv)}
                    </span>
                    <span className="text-[13px] text-ink-3">{Math.round(weekHours(drv.id))} h scheduled</span>
                  </th>
                  {days.map((d) => {
                    const c = cell(drv.id, d);
                    const offShiftTrips = c.trips.filter(
                      (x) => !c.shifts.some((s) => s.startsAt <= x.r.pickupAt && s.endsAt > x.r.pickupAt),
                    ).length;
                    return (
                      <td key={d} className={`px-1.5 py-2 ${d === today ? "bg-route-wash/40" : ""}`}>
                        {c.shifts.length === 0 && c.trips.length === 0 ? (
                          <span className="pl-1 text-[13px] text-ink-3">Off</span>
                        ) : null}
                        {c.shifts.map((s) => (
                          <div
                            key={s.id}
                            className="group mb-1 flex items-center justify-between rounded border-l-[3px] bg-paper px-1.5 py-1 text-[13px]"
                            style={{ borderColor: drv.color }}
                          >
                            <span className="font-semibold" title={s.notes ?? undefined}>
                              {formatTime(s.startsAt).replace(":00", "")}–{formatTime(s.endsAt).replace(":00", "")}
                            </span>
                            <ActionButton
                              run={deleteShift.bind(null, s.id)}
                              className="rounded px-1 text-ink-3 opacity-0 hover:text-stop focus:opacity-100 group-hover:opacity-100"
                              label={`Remove ${fullName(drv)}'s shift on ${formatDayKey(d)}`}
                            >
                              ×
                            </ActionButton>
                          </div>
                        ))}
                        {c.trips.length ? (
                          <div className="pl-1 text-[13px] text-ink-2">
                            {c.trips.length} trip
                            {c.trips.length === 1 ? "" : "s"}
                            {offShiftTrips ? (
                              <div className="font-semibold text-stop">{offShiftTrips} off shift</div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
