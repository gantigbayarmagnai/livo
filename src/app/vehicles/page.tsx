import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { addVehicle, toggleVehicleActive } from "@/app/actions";
import { ActionButton, InlineForm } from "@/components/resource-forms";
import { LoadingRows, PageHeader } from "@/components/ui";
import { money } from "@/lib/labels";
import { getResources } from "@/lib/queries";

export const metadata: Metadata = { title: "Vehicles" };

export default function VehiclesPage() {
  return (
    <>
      <PageHeader title="Vehicles" sub="Fleet and the rate card each vehicle type books at." />
      <Suspense fallback={<LoadingRows />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await connection();
  const res = await getResources();
  return (
    <div className="space-y-5 px-4 py-5 md:px-8">
      <section className="rounded-lg border border-line bg-surface">
        <h2 className="border-b border-line px-4 py-2.5 font-semibold">Vehicle types and rates</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead className="text-[13px] text-ink-3">
              <tr>
                <th className="py-2 pl-4 font-medium">Type</th>
                <th className="py-2 font-medium">Seats</th>
                <th className="py-2 font-medium">Base rate</th>
                <th className="py-2 font-medium">Hourly</th>
                <th className="py-2 pr-4 font-medium">Hourly minimum</th>
              </tr>
            </thead>
            <tbody>
              {res.vehicleTypes.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="py-2 pl-4 font-semibold">{t.name}</td>
                  <td className="py-2">{t.capacity}</td>
                  <td className="py-2">{money(t.baseRate)}</td>
                  <td className="py-2">{money(t.hourlyRate)}</td>
                  <td className="py-2 pr-4">{t.minHours} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 font-semibold">Add a vehicle</h2>
        <InlineForm action={addVehicle} submitLabel="Add vehicle" savedLabel="Vehicle added.">
          <label className="block">
            <span className="label">Name</span>
            <input name="name" className="field" placeholder="SUV 204" required />
          </label>
          <label className="block">
            <span className="label">Type</span>
            <select name="vehicleTypeId" className="field" required>
              {res.vehicleTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Plate</span>
            <input name="plate" className="field w-32" />
          </label>
          <label className="block">
            <span className="label">Color</span>
            <input name="color" className="field w-28" />
          </label>
          <label className="block">
            <span className="label">Year</span>
            <input name="year" type="number" className="field w-24" />
          </label>
        </InlineForm>
      </section>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead className="border-b border-line text-[13px] text-ink-3">
            <tr>
              <th className="py-2 pl-4 font-medium">Vehicle</th>
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 font-medium">Plate</th>
              <th className="py-2 font-medium">Year & color</th>
              <th className="py-2 font-medium">In service</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {res.vehicles.map((v) => (
              <tr key={v.id} className={`border-b border-line last:border-0 ${v.active ? "" : "text-ink-3"}`}>
                <td className="py-2 pl-4 font-semibold">{v.name}</td>
                <td className="py-2 pr-3">{v.typeName}</td>
                <td className="py-2 pr-3">{v.plate}</td>
                <td className="py-2 pr-3">{[v.year, v.color].filter(Boolean).join(" · ")}</td>
                <td className="py-2 pr-3">{v.active ? "Yes" : "No"}</td>
                <td className="py-2 pr-4 text-right">
                  <ActionButton run={toggleVehicleActive.bind(null, v.id)} className="btn py-1">
                    {v.active ? "Take out of service" : "Return to service"}
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
