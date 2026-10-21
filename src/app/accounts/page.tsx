import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { addAccount } from "@/app/actions";
import { InlineForm } from "@/components/resource-forms";
import { Loading, ViewHead } from "@/components/ui";
import { accountsWithCounts } from "@/lib/queries";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <>
      <ViewHead eyebrow="Accounts" title="Clients, affiliates and partners" />
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>Add an account</h2>
        <InlineForm action={addAccount} submitLabel="Add account" savedLabel="Account added.">
          <Field name="company" label="Company" />
          <Field name="firstName" label="Contact first name" required />
          <Field name="lastName" label="Contact last name" required />
          <Field name="phone" label="Phone" type="tel" />
          <Field name="email" label="Email" type="email" />
          <Field name="notes" label="Billing" placeholder="Card on file, monthly invoice…" />
        </InlineForm>
      </div>
      <Suspense fallback={<Loading />}>
        <Table />
      </Suspense>
    </>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span className="flabel">{label}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} />
    </label>
  );
}

async function Table() {
  await connection();
  const rows = await accountsWithCounts();
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Account</th>
            <th>Type</th>
            <th>Contact</th>
            <th>Phone</th>
            <th>Billing</th>
            <th className="num">Trips</th>
            <th>Latest trip</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ a, trips, last }) => {
            const name = a.company ?? `${a.firstName} ${a.lastName}`;
            const type = /affiliate/i.test(a.notes ?? "") ? "Affiliate" : a.company ? "Corporate" : "Individual";
            return (
              <tr key={a.id}>
                <td>
                  <b>{name}</b> <span className="muted mono">#{a.accountNumber}</span>
                </td>
                <td>{type}</td>
                <td>{a.company ? `${a.firstName} ${a.lastName}` : "—"}</td>
                <td>{a.phone}</td>
                <td>{a.notes ?? "—"}</td>
                <td className="num">
                  {trips ? (
                    <Link href={`/reservations?q=${encodeURIComponent(a.company ?? a.lastName)}`}>{trips}</Link>
                  ) : (
                    0
                  )}
                </td>
                <td>{last ? formatDate(new Date(last)) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
