import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SetupForm } from "@/components/auth-forms";
import { Loading } from "@/components/ui";
import { MIN_PASSWORD, userCount } from "@/lib/auth";

export const metadata: Metadata = { title: "Set up Livo" };

export default function SetupPage() {
  return (
    <div className="auth">
      <div className="eyebrow">First run</div>
      <h1>Set up Livo</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Create the owner account. You’ll add dispatchers and chauffeurs from My Office → Team.
      </p>
      <Suspense fallback={<Loading rows={4} />}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  // Only available until the first account exists.
  if ((await userCount()) > 0) redirect("/login");
  return <SetupForm min={MIN_PASSWORD} needsCode={!!process.env.LIVO_SETUP_CODE} />;
}
