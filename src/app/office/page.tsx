import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { addTripStatus } from "@/app/actions";
import { OfficeTabs } from "@/components/office-tabs";
import { InlineForm } from "@/components/resource-forms";
import { StatusColors } from "@/components/status-colors";
import { Loading, ViewHead } from "@/components/ui";
import { money } from "@/lib/labels";
import { getResources, listTripStatuses, nextConfNumber } from "@/lib/queries";

export const metadata: Metadata = { title: "My Office" };

export default function OfficePage() {
  return (
    <>
      <ViewHead
        eyebrow="My Office"
        title="Company settings and rate management"
        desc="The rate card here drives every quote in Livo."
      />
      <OfficeTabs current="/office" />
      <Suspense fallback={<Loading rows={8} />}>
        <Office />
      </Suspense>
    </>
  );
}

async function Office() {
  await connection();
  const [res, statuses, conf] = await Promise.all([getResources(), listTripStatuses(), nextConfNumber()]);
  return (
    <div className="grid2">
      <div className="tbl-wrap" style={{ alignSelf: "start" }}>
        <table className="tbl" style={{ minWidth: 520 }}>
          <thead>
            <tr>
              <th>Vehicle</th>
              <th className="num">SFO → SF</th>
              <th className="num">Hourly</th>
              <th className="num">Minimum</th>
            </tr>
          </thead>
          <tbody>
            {res.vehicleTypes.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.name} <span className="muted">· {t.capacity} seats</span>
                </td>
                <td className="num">{Number(t.baseRate) ? money(t.baseRate) : "—"}</td>
                <td className="num">{Number(t.hourlyRate) ? `${money(t.hourlyRate)}/hr` : "—"}</td>
                <td className="num">
                  {Number(t.hourlyRate) ? (t.capacity <= 6 ? "3 hrs SF · 6 other" : "6 hrs") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stack">
        <div className="panel">
          <h2>Add-ons and surcharges</h2>
          <dl className="kv">
            <dt>Driver Meet &amp; Greet</dt>
            <dd>$50 · chauffeur meets at bag claim, walks to garage</dd>
            <dt>Greeter service</dt>
            <dd>$100 · greeter escorts to curbside</dd>
            <dt>Late/early pickup</dt>
            <dd>$30 · 9:00 PM to 7:00 AM</dd>
            <dt>Hourly deposit</dt>
            <dd>$600 pre-authorized</dd>
            <dt>Mileage</dt>
            <dd>200 mi/day included · Sedan $2/mi · SUV and larger $3/mi</dd>
          </dl>
        </div>
        <div className="panel">
          <h2>Reservation statuses</h2>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: 12.5 }}>
            Your own statuses and colors, as in Limo Anywhere. They color the Calendar.
          </p>
          <StatusColors statuses={statuses} />
          <div style={{ marginTop: 14 }}>
            <InlineForm action={addTripStatus} submitLabel="Add status" savedLabel="Status added.">
              <label className="field" style={{ flex: 1, minWidth: 180 }}>
                <span className="flabel">New status</span>
                <input name="name" placeholder="e.g. Waiting on deposit" required />
              </label>
              <label className="field" style={{ minWidth: 0 }}>
                <span className="flabel">Color</span>
                <input name="color" type="color" defaultValue="#95c2ef" style={{ width: 48, height: 36, padding: 2 }} />
              </label>
            </InlineForm>
          </div>
        </div>
        <div className="panel">
          <h2>Company</h2>
          <dl className="kv">
            <dt>Name</dt>
            <dd>{process.env.NEXT_PUBLIC_COMPANY_NAME || "MGL Limo Worldwide"}</dd>
            <dt>Reservations</dt>
            <dd>(415) 699-3138, 24/7</dd>
            <dt>Email</dt>
            <dd>contact@mgllimo.com</dd>
            <dt>Next conf #</dt>
            <dd className="mono">{conf} · continues Limo Anywhere</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
