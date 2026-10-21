import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { createReservation } from "@/app/actions";
import { ReservationForm } from "@/components/reservation-form";
import { Loading, ViewHead } from "@/components/ui";
import { getResources, listTripStatuses, nextConfNumber } from "@/lib/queries";
import { addDays, isDateKey, todayKey } from "@/lib/time";

export const metadata: Metadata = { title: "New Res/Quote" };

export default function NewReservationPage({ searchParams }: PageProps<"/reservations/new">) {
  return (
    <>
      <ViewHead
        eyebrow="New Res/Quote"
        title="New reservation"
        desc="Priced live from the rate card. Times are Pacific."
      />
      <Suspense fallback={<Loading rows={8} />}>
        <NewForm searchParams={searchParams as Promise<{ date?: string }>} />
      </Suspense>
    </>
  );
}

async function NewForm({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await connection();
  const sp = await searchParams;
  const [res, tripStatuses, conf] = await Promise.all([getResources(), listTripStatuses(), nextConfNumber()]);
  const date = isDateKey(sp.date) ? sp.date : addDays(todayKey(), 2);
  return (
    <ReservationForm
      action={createReservation}
      pickupDate={date}
      pickupTime="14:00"
      confNumber={conf}
      isNew
      options={{ ...res, tripStatuses }}
    />
  );
}
