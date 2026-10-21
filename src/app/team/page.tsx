import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { Suspense } from "react";
import { OfficeTabs } from "@/components/office-tabs";
import { AddMember, MemberRow } from "@/components/team";
import { Loading, ViewHead } from "@/components/ui";
import { db, schema } from "@/db";
import { requirePage } from "@/lib/auth";
import { fullName } from "@/lib/labels";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <>
      <ViewHead eyebrow="My Office" title="Team" desc="Who can sign in to Livo, and what each person can do." />
      <OfficeTabs current="/team" />
      <Suspense fallback={<Loading rows={5} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const me = await requirePage("team");
  const [members, drivers] = await Promise.all([
    db.select().from(schema.users).orderBy(asc(schema.users.role), asc(schema.users.name)),
    db.select().from(schema.drivers).orderBy(asc(schema.drivers.firstName)),
  ]);
  const driverOpts = drivers.filter((d) => d.status === "active").map((d) => ({ id: d.id, name: fullName(d) }));
  const now = new Date();
  return (
    <div className="stack">
      <div className="panel">
        <h2>Add someone</h2>
        <AddMember drivers={driverOpts} />
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((u) => (
              <MemberRow
                key={u.id}
                isMe={u.id === me.id}
                drivers={driverOpts}
                m={{
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  driverId: u.driverId,
                  active: u.active,
                  mustChangePassword: u.mustChangePassword,
                  lastLogin: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : null,
                  locked: !!u.lockedUntil && u.lockedUntil > now,
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
