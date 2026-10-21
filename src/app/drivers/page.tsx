import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { addDriver, toggleDriverStatus } from "@/app/actions";
import { ActionButton, InlineForm } from "@/components/resource-forms";
import { DriverDot, LoadingRows, PageHeader } from "@/components/ui";
import { fullName } from "@/lib/labels";
import { getResources } from "@/lib/queries";

export const metadata: Metadata = { title: "Drivers" };

export default function DriversPage() {
  return (
    <>
      <PageHeader
        title="Drivers"
        sub="Each driver's color follows them across dispatch, the calendar and the schedule."
      />
      <Suspense fallback={<LoadingRows />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await connection();
  const res = await getResources();
  const vehicleName = (id: string | null) => res.vehicles.find((v) => v.id === id)?.name;
  return (
    <div className="space-y-5 px-4 py-5 md:px-8">
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 font-semibold">Add a driver</h2>
        <InlineForm action={addDriver} submitLabel="Add driver" savedLabel="Driver added.">
          {[
            ["firstName", "First name", "text", true],
            ["lastName", "Last name", "text", true],
            ["phone", "Phone", "tel", false],
            ["email", "Email", "email", false],
          ].map(([id, label, type, req]) => (
            <label className="block" key={id as string}>
              <span className="label">{label}</span>
              <input name={id as string} type={type as string} className="field" required={req as boolean} />
            </label>
          ))}
          <label className="block">
            <span className="label">Usual vehicle</span>
            <select name="defaultVehicleId" className="field">
              <option value="">None</option>
              {res.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Color</span>
            <input name="color" type="color" className="field h-[38px] w-16 p-1" defaultValue="#0f766e" />
          </label>
        </InlineForm>
      </section>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead className="border-b border-line text-[13px] text-ink-3">
            <tr>
              <th className="py-2 pl-4 font-medium">Driver</th>
              <th className="py-2 font-medium">Phone</th>
              <th className="py-2 font-medium">Usual vehicle</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {res.drivers.map((d) => (
              <tr
                key={d.id}
                className={`border-b border-line last:border-0 ${d.status === "inactive" ? "text-ink-3" : ""}`}
              >
                <td className="py-2 pl-4 pr-3">
                  <span className="flex items-center gap-2 font-semibold">
                    <DriverDot color={d.color} />
                    {fullName(d)}
                  </span>
                </td>
                <td className="py-2 pr-3">{d.phone}</td>
                <td className="py-2 pr-3">{vehicleName(d.defaultVehicleId) ?? "—"}</td>
                <td className="py-2 pr-3">{d.status === "active" ? "Active" : "Inactive"}</td>
                <td className="py-2 pr-4 text-right">
                  <ActionButton run={toggleDriverStatus.bind(null, d.id)} className="btn py-1">
                    {d.status === "active" ? "Deactivate" : "Reactivate"}
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
