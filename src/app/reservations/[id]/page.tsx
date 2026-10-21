import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { duplicateReservation, updateReservation } from "@/app/actions";
import { ReservationForm } from "@/components/reservation-form";
import { LoadingRows, PageHeader, StatusBadge } from "@/components/ui";
import { getReservation, getResources } from "@/lib/queries";
import { formatDateTime, toDateKey, toLocalInput } from "@/lib/time";

export const metadata: Metadata = { title: "Reservation" };

export default function ReservationPage({ params, searchParams }: PageProps<"/reservations/[id]">) {
  return (
    <Suspense fallback={<LoadingRows rows={10} />}>
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
  const [data, options, sp] = await Promise.all([getReservation(id), getResources(), searchParams]);
  if (!data) notFound();
  const r = data.r;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            #{r.confNumber} {r.passengerName} <StatusBadge status={r.status} />
          </span>
        }
        sub={
          <>
            {formatDateTime(r.pickupAt)}
            {data.account ? ` · ${data.account.company ?? `${data.account.firstName} ${data.account.lastName}`}` : ""}
          </>
        }
        actions={
          <>
            <Link className="btn" href={`/dispatch?date=${toDateKey(r.pickupAt)}`}>
              Open on dispatch
            </Link>
            <form action={duplicateReservation.bind(null, r.id)}>
              <button className="btn" type="submit">
                Copy as new
              </button>
            </form>
          </>
        }
      />
      <div className="space-y-6 px-4 py-5 md:px-8">
        {sp.created ? (
          <p
            role="status"
            className="rounded-md border border-route/30 bg-route-wash px-4 py-2.5 font-semibold text-route-ink"
          >
            Reservation #{r.confNumber} booked.
          </p>
        ) : null}
        <ReservationForm
          action={updateReservation.bind(null, r.id)}
          initial={r}
          pickupLocal={toLocalInput(r.pickupAt)}
          options={options}
          submitLabel="Save changes"
        />
        <section className="max-w-3xl">
          <h2 className="mb-2 font-semibold">History</h2>
          <ol className="border-l-2 border-line">
            {data.events.map((e) => (
              <li key={e.id} className="relative pb-3 pl-4">
                <span aria-hidden className="absolute -left-[5px] top-2 size-2 rounded-full bg-line-strong" />
                <span className="text-[13px] text-ink-3">{formatDateTime(e.createdAt)}</span>
                <div>{e.message}</div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
