import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { addVehicle, toggleVehicleActive } from "@/app/actions";
import { OfficeTabs } from "@/components/office-tabs";
import { ActionButton, InlineForm } from "@/components/resource-forms";
import { Loading, ViewHead } from "@/components/ui";
import { getResources } from "@/lib/queries";

export const metadata: Metadata = { title: "Vehicles" };

export default function VehiclesPage() {
  return (
    <>
      <ViewHead eyebrow="My Office" title="Vehicles" />
      <OfficeTabs current="/vehicles" />
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await connection();
  const res = await getResources();
  return (
    <div className="stack">
      <div className="panel">
        <h2>Add a vehicle</h2>
        <InlineForm action={addVehicle} submitLabel="Add vehicle" savedLabel="Vehicle added.">
          <label className="field">
            <span className="flabel">Unit</span>
            <input name="name" placeholder="MGL22" required />
          </label>
          <label className="field">
            <span className="flabel">Type</span>
            <select name="vehicleTypeId" required>
              {res.vehicleTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="flabel">Plate</span>
            <input name="plate" />
          </label>
          <label className="field">
            <span className="flabel">Color</span>
            <input name="color" />
          </label>
          <label className="field">
            <span className="flabel">Year</span>
            <input name="year" type="number" />
          </label>
        </InlineForm>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Type</th>
              <th>Plate</th>
              <th>Year · color</th>
              <th>In service</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {res.vehicles.map((v) => (
              <tr key={v.id} className={v.active ? "" : "muted"}>
                <td className="mono">
                  <b>{v.name}</b>
                </td>
                <td>{v.typeName}</td>
                <td className="mono">{v.plate ?? "—"}</td>
                <td>{[v.year, v.color].filter(Boolean).join(" · ") || "—"}</td>
                <td>{v.active ? <span className="chip good">Yes</span> : <span className="chip plain">No</span>}</td>
                <td style={{ textAlign: "right" }}>
                  <ActionButton run={toggleVehicleActive.bind(null, v.id)} className="btn small">
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
