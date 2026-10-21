import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { duplicateReservation, updateReservation } from "@/app/actions";
import { ReservationForm } from "@/components/reservation-form";
import { Loading, TripStatusChip } from "@/components/ui";
import { MEET_GREET, quote, type MeetGreet } from "@/lib/pricing";
import { getReservation, getResources, listTripStatuses } from "@/lib/queries";
import { formatDateTime, hhmm, toDateKey } from "@/lib/time";

export const metadata: Metadata = { title: "Reservation" };

export default function ReservationPage({ params, searchParams }: PageProps<"/reservations/[id]">) {
  return (
    <Suspense fallback={<Loading rows={10} />}>
      <Detail params={params} searchParams={searchParams as Promise<{ created?: string }>} />
    </Suspense>
  );
}

const UUID = /^[0-9a-f-]{36}$/i;

async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  await connection();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [data, res, tripStatuses, sp] = await Promise.all([
    getReservation(id),
    getResources(),
    listTripStatuses(),
    searchParams,
  ]);
  if (!data) notFound();
  const r = data.r;
  const status = tripStatuses.find((s) => s.id === r.tripStatusId);

  // Recover the staff price and tolls from what was saved.
  const type = res.vehicleTypes.find((t) => t.id === r.vehicleTypeId) ?? null;
  const time = hhmm(r.pickupAt);
  const hours = r.serviceType === "hourly" ? r.estDurationMin / 60 : 0;
  const card = quote({
    service: r.serviceType,
    type,
    hours,
    outsideSf: r.outsideSf,
    meetGreet: r.meetGreet as MeetGreet,
    pickupTime: time,
    staffPrice: 0,
    tolls: 0,
  });
  const staffPrice = card.staff || Math.abs(card.base - Number(r.baseRate)) > 0.009 ? Number(r.baseRate) : 0;
  const h = Number(time.slice(0, 2));
  const fixedAddOns =
    (r.serviceType === "airport_arrival" ? (MEET_GREET[r.meetGreet as MeetGreet]?.price ?? 0) : 0) +
    (h >= 21 || h < 7 ? 30 : 0);
  const tolls = Math.max(0, Number(r.extras) - fixedAddOns);

  return (
    <>
      <div className="view-head">
        <div>
          <div className="eyebrow">Reservation</div>
          <h1 style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="mono">#{r.confNumber}</span> {r.passengerName} <TripStatusChip status={status} />
          </h1>
          <p>
            {formatDateTime(r.pickupAt)}
            {data.account ? ` · ${data.account.company ?? `${data.account.firstName} ${data.account.lastName}`}` : ""}
          </p>
        </div>
        <div className="actions">
          <Link className="btn" href={`/dispatch?date=${toDateKey(r.pickupAt)}&sel=${r.id}`}>
            Open in Dispatch
          </Link>
          <Link className="btn" href={`/calendar?view=day&date=${toDateKey(r.pickupAt)}`}>
            Show on Calendar
          </Link>
          <form action={duplicateReservation.bind(null, r.id)}>
            <button className="btn" type="submit">
              Copy as new
            </button>
          </form>
        </div>
      </div>
      {sp.created ? (
        <p role="status" className="okbox" style={{ marginBottom: 16 }}>
          Reservation #{r.confNumber} saved. Assign a chauffeur on Dispatch.
        </p>
      ) : null}
      <ReservationForm
        action={updateReservation.bind(null, r.id)}
        initial={r}
        pickupDate={toDateKey(r.pickupAt)}
        pickupTime={time}
        confNumber={r.confNumber}
        isNew={false}
        options={{ ...res, tripStatuses }}
        initialStaffPrice={staffPrice}
        initialTolls={tolls}
      />
      <section className="panel" style={{ marginTop: 16, maxWidth: 760 }}>
        <h2>History</h2>
        <div className="tbl-wrap" style={{ border: 0 }}>
          <table className="tbl" style={{ minWidth: 0 }}>
            <tbody>
              {data.events.map((e) => (
                <tr key={e.id}>
                  <td className="mono muted" style={{ whiteSpace: "nowrap", width: 1 }}>
                    {formatDateTime(e.createdAt)}
                  </td>
                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
