import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { and, gte, inArray, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { ACTIVE_STATUSES } from "@/lib/labels";
import { addDays, formatDayKey, todayKey, zonedToUtc } from "@/lib/time";
import { NavLive } from "./nav-live";
import { NavSections } from "./nav-sections";
import { RateDrawer } from "./rate-drawer";

const COMPANY = process.env.NEXT_PUBLIC_COMPANY_NAME || "MGL Limo Worldwide";

export function TopBar() {
  return (
    <header className="top">
      <div className="wrap topbar">
        <div className="brand">
          <Link href="/dispatch" className="wordmark" aria-label="Livo home">
            liv<span>o</span>
          </Link>
          <div className="operator">
            {COMPANY}
            <Suspense fallback={null}>
              <Today />
            </Suspense>
          </div>
        </div>
        <div className="tools">
          <RateDrawer />
          <Link className="tbtn gold" href="/reservations/new">
            New Res/Quote
          </Link>
          <form action="/reservations" role="search">
            <input name="q" type="search" placeholder="Search conf #, name, account" aria-label="Search reservations" />
          </form>
        </div>
      </div>
      <nav className="sections" aria-label="Sections">
        <Suspense fallback={<NavSections counts={{}} current={null} />}>
          <NavWithCounts />
        </Suspense>
      </nav>
    </header>
  );
}

async function Today() {
  await connection();
  return <> · {formatDayKey(todayKey(), { weekday: "long", month: "long", day: "numeric" })}</>;
}

/** Red badges: trips in the next 3 days still needing a chauffeur. */
async function NavWithCounts() {
  await connection();
  const today = todayKey();
  const r = schema.reservations;
  const open = await db
    .select({ id: r.id })
    .from(r)
    .where(
      and(
        gte(r.pickupAt, zonedToUtc(today)),
        lt(r.pickupAt, zonedToUtc(addDays(today, 3))),
        isNull(r.driverId),
        inArray(r.status, ACTIVE_STATUSES),
      ),
    );
  return <NavLive counts={{ dispatch: open.length }} />;
}
