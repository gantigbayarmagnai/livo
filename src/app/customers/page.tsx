import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { addAccount } from "@/app/actions";
import { InlineForm } from "@/components/resource-forms";
import { LoadingRows, PageHeader } from "@/components/ui";
import { accountsWithCounts } from "@/lib/queries";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" sub="Billing accounts. Pick one when booking to fill in the passenger." />
      <div className="space-y-5 px-4 py-5 md:px-8">
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="mb-3 font-semibold">Add a customer</h2>
          <InlineForm action={addAccount} submitLabel="Add customer" savedLabel="Customer added.">
            <Field id="firstName" label="First name" required />
            <Field id="lastName" label="Last name" required />
            <Field id="company" label="Company" />
            <Field id="phone" label="Phone" type="tel" />
            <Field id="email" label="Email" type="email" />
          </InlineForm>
        </section>
        <Suspense fallback={<LoadingRows />}>
          <Table />
        </Suspense>
      </div>
    </>
  );
}

function Field({
  id,
  label,
  type = "text",
  required,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input name={id} type={type} className="field" required={required} />
    </label>
  );
}

async function Table() {
  await connection();
  const rows = await accountsWithCounts();
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead className="border-b border-line text-[13px] text-ink-3">
          <tr>
            <th className="py-2 pl-4 font-medium">Acct #</th>
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Company</th>
            <th className="py-2 font-medium">Phone</th>
            <th className="py-2 font-medium">Email</th>
            <th className="py-2 font-medium">Trips</th>
            <th className="py-2 pr-4 font-medium">Latest trip</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ a, trips, last }) => (
            <tr key={a.id} className="border-b border-line last:border-0">
              <td className="py-2 pl-4 text-ink-3">{a.accountNumber}</td>
              <td className="py-2 pr-3 font-semibold">
                {a.lastName}, {a.firstName}
              </td>
              <td className="py-2 pr-3">{a.company ?? <span className="text-ink-3">—</span>}</td>
              <td className="py-2 pr-3">{a.phone}</td>
              <td className="py-2 pr-3">{a.email}</td>
              <td className="py-2 pr-3">
                {trips ? (
                  <Link
                    className="text-route hover:underline"
                    href={`/reservations?q=${encodeURIComponent(a.company ?? a.lastName)}&from=2000-01-01&to=2100-01-01`}
                  >
                    {trips}
                  </Link>
                ) : (
                  0
                )}
              </td>
              <td className="py-2 pr-4 text-ink-2">{last ? formatDate(new Date(last)) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
