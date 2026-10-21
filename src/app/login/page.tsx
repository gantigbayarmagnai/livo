import type { Metadata } from "next";
import { COMPANY_NAME } from "@/lib/company";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth-forms";
import { Loading } from "@/components/ui";
import { getCurrentUser, userCount } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="auth">
      <div className="eyebrow">Livo</div>
      <h1>Sign in</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {COMPANY_NAME}
      </p>
      <Suspense fallback={<Loading rows={3} />}>
        <Gate searchParams={searchParams as Promise<{ next?: string }>} />
      </Suspense>
    </div>
  );
}

async function Gate({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if ((await userCount()) === 0) redirect("/setup");
  const me = await getCurrentUser();
  if (me) redirect(homeFor(me.role));
  const { next } = await searchParams;
  return <SignInForm next={next ?? null} />;
}
