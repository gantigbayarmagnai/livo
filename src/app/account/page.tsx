import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/app/auth-actions";
import { ChangePasswordForm } from "@/components/auth-forms";
import { Loading, ViewHead } from "@/components/ui";
import { MIN_PASSWORD, requirePage } from "@/lib/auth";
import { ROLE_HELP, ROLE_LABELS } from "@/lib/roles";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <>
      <ViewHead eyebrow="Account" title="Your account" />
      <Suspense fallback={<Loading rows={4} />}>
        <Content searchParams={searchParams as Promise<{ first?: string }>} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const me = await requirePage(null, { allowTempPassword: true });
  const { first } = await searchParams;
  return (
    <div className="grid2" style={{ maxWidth: 900 }}>
      <ChangePasswordForm min={MIN_PASSWORD} first={me.mustChangePassword || first === "1"} />
      <div className="panel" style={{ alignSelf: "start" }}>
        <h2>Signed in as</h2>
        <dl className="kv">
          <dt>Name</dt>
          <dd>{me.name}</dd>
          <dt>Email</dt>
          <dd>{me.email}</dd>
          <dt>Role</dt>
          <dd>
            {ROLE_LABELS[me.role]}
            <div className="muted" style={{ fontSize: 12.5 }}>
              {ROLE_HELP[me.role]}
            </div>
          </dd>
        </dl>
        <form action={signOut} className="actions">
          <button className="btn" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
