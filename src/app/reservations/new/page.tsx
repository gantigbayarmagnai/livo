import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { createReservation } from "@/app/actions";
import { ReservationForm } from "@/components/reservation-form";
import { LoadingRows, PageHeader } from "@/components/ui";
import { getResources } from "@/lib/queries";
import { isDateKey, todayKey } from "@/lib/time";

export const metadata: Metadata = { title: "New reservation" };

export default function NewReservationPage({ searchParams }: PageProps<"/reservations/new">) {
  return (
    <>
      <PageHeader title="New reservation" sub="Times are in company time." />
      <div className="px-4 py-5 md:px-8">
        <Suspense fallback={<LoadingRows />}>
          <NewForm searchParams={searchParams as Promise<{ date?: string }>} />
        </Suspense>
      </div>
    </>
  );
}

async function NewForm({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await connection();
  const sp = await searchParams;
  const options = await getResources();
  const date = isDateKey(sp.date) ? sp.date : todayKey();
  return (
    <ReservationForm
      action={createReservation}
      pickupLocal={`${date}T09:00`}
      options={options}
      submitLabel="Book reservation"
    />
  );
}
