import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/roles";

const TABS = [
  { href: "/office", label: "Rates and statuses" },
  { href: "/drivers", label: "Chauffeurs" },
  { href: "/vehicles", label: "Vehicles" },
];

/** My Office sub-tabs. The Team tab streams in for owners only. */
export function OfficeTabs({ current }: { current: string }) {
  return (
    <div className="subtabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="subtab" aria-current={t.href === current ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
      <Suspense fallback={null}>
        <TeamTab current={current} />
      </Suspense>
    </div>
  );
}

async function TeamTab({ current }: { current: string }) {
  const me = await getCurrentUser();
  if (!can(me?.role, "team")) return null;
  return (
    <Link href="/team" className="subtab" aria-current={current === "/team" ? "page" : undefined}>
      Team
    </Link>
  );
}
