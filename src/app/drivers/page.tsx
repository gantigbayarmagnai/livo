import type { Metadata } from "next";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/roles";
import { Suspense } from "react";
import { addDriver, toggleDriverStatus } from "@/app/actions";
import { OfficeTabs } from "@/components/office-tabs";
import { ActionButton, InlineForm } from "@/components/resource-forms";
import { Loading, ViewHead } from "@/components/ui";
import { fullName } from "@/lib/labels";
import { getResources } from "@/lib/queries";

export const metadata: Metadata = { title: "Chauffeurs" };

export default function DriversPage() {
  return (
    <>
      <ViewHead eyebrow="My Office" title="Chauffeurs" />
      <OfficeTabs current="/drivers" />
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const me = await requirePage("ops");
  const res = await getResources();
  const vehicle = (id: string | null) => res.vehicles.find((v) => v.id === id);
  return (
    <div className="stack">
      {can(me.role, "settings") ? (
        <div className="panel">
          <h2>Add a chauffeur</h2>
          <InlineForm action={addDriver} submitLabel="Add chauffeur" savedLabel="Chauffeur added.">
            <label className="field">
              <span className="flabel">First name</span>
              <input name="firstName" required />
            </label>
            <label className="field">
              <span className="flabel">Last name</span>
              <input name="lastName" required />
            </label>
            <label className="field">
              <span className="flabel">Phone</span>
              <input name="phone" type="tel" />
            </label>
            <label className="field">
              <span className="flabel">Usual vehicle</span>
              <select name="defaultVehicleId">
                <option value="">None</option>
                {res.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.typeName}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="color" value="#5b636c" />
          </InlineForm>
        </div>
      ) : null}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Chauffeur</th>
              <th>Phone</th>
              <th>Usual vehicle</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {res.drivers.map((d) => {
              const v = vehicle(d.defaultVehicleId);
              return (
                <tr key={d.id} className={d.status === "inactive" ? "muted" : ""}>
                  <td>
                    <b>{fullName(d)}</b>
                  </td>
                  <td>{d.phone}</td>
                  <td>{v ? `${v.name} · ${v.typeName}` : "—"}</td>
                  <td>
                    {d.status === "active" ? (
                      <span className="chip good">Active</span>
                    ) : (
                      <span className="chip plain">Inactive</span>
                    )}
                  </td>
                  {can(me.role, "settings") ? (
                    <td style={{ textAlign: "right" }}>
                      <ActionButton run={toggleDriverStatus.bind(null, d.id)} className="btn small">
                        {d.status === "active" ? "Deactivate" : "Reactivate"}
                      </ActionButton>
                    </td>
                  ) : (
                    <td />
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
