import { Suspense } from "react";
import { requirePage } from "@/lib/auth";
import { ViewHead } from "./ui";

async function Guard() {
  await requirePage("ops");
  return null;
}

/** Sections from Limo Anywhere that Livo hasn't built yet. */
export function NotBuilt({ eyebrow, title, plan }: { eyebrow: string; title: string; plan: string[] }) {
  return (
    <>
      <Suspense fallback={null}>
        <Guard />
      </Suspense>
      <ViewHead eyebrow={eyebrow} title={title} desc="Not built yet in this version of Livo. Here's what goes here." />
      <div className="panel">
        <ul className="notes" style={{ marginTop: 0, fontSize: 13.5, color: "var(--ink)" }}>
          {plan.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
