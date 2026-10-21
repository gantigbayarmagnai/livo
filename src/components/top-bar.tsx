import Link from "next/link";
import { Suspense } from "react";
import { and, gte, inArray, isNull, lt } from "drizzle-orm";
import { signOut } from "@/app/auth-actions";
import { db, schema } from "@/db";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { ACTIVE_STATUSES } from "@/lib/labels";
import { ROLE_LABELS, can } from "@/lib/roles";
import { addDays, formatDayKey, todayKey, zonedToUtc } from "@/lib/time";
import { NavLive } from "./nav-live";
import { RateDrawer } from "./rate-drawer";

const COMPANY = process.env.NEXT_PUBLIC_COMPANY_NAME || "MGL Limo Worldwide";

/** The dark bar. Everything that depends on who is signed in streams in. */
export function TopBar() {
  return (
    <header className="top">
      <Suspense fallback={<Shell />}>
        <ForUser />
      </Suspense>
    </header>
  );
}

function Brand({ children }: { children?: React.ReactNode }) {
  return (
    <div className="brand">
      <Link href="/" className="wordmark" aria-label="Livo home">
        liv<span>o</span>
      </Link>
      <div className="operator">
        {COMPANY}
        {children}
      </div>
    </div>
  );
}

function Shell() {
  return (
    <>
      <div className="wrap topbar">
        <Brand />
      </div>
      <nav className="sections" aria-hidden>
        <div className="wrap inner" style={{ height: 40 }} />
      </nav>
    </>
  );
}

async function ForUser() {
  const me = await getCurrentUser();
  const today = <> · {formatDayKey(todayKey(), { weekday: "long", month: "long", day: "numeric" })}</>;
  if (!me) {
    return (
      <div className="wrap topbar">
        <Brand />
      </div>
    );
  }
  const ops = can(me.role, "ops");
  return (
    <>
      <div className="wrap topbar">
        <Brand>{today}</Brand>
        <div className="tools">
          {ops ? (
            <>
              <RateDrawer />
              <Link className="tbtn gold" href="/reservations/new">
                New Res/Quote
              </Link>
              <form action="/reservations" role="search">
                <input
                  name="q"
                  type="search"
                  placeholder="Search conf #, name, account"
                  aria-label="Search reservations"
                />
              </form>
            </>
          ) : null}
          <UserMenu me={me} />
        </div>
      </div>
      {ops ? (
        <nav className="sections" aria-label="Sections">
          <NavLive counts={{ dispatch: await openTrips() }} />
        </nav>
      ) : (
        <nav className="sections" aria-label="Sections">
          <div className="wrap inner">
            <Link href="/my-trips" className="sec" aria-current="page">
              My trips
            </Link>
          </div>
        </nav>
      )}
    </>
  );
}

function UserMenu({ me }: { me: CurrentUser }) {
  return (
    <details className="usermenu">
      <summary className="tbtn" aria-label={`Signed in as ${me.name}`}>
        {me.name.split(" ")[0]}
      </summary>
      <div className="usermenu-pop">
        <div style={{ fontWeight: 600 }}>{me.name}</div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          {me.email} · {ROLE_LABELS[me.role]}
        </div>
        <div className="actions" style={{ marginTop: 10 }}>
          <Link className="btn small" href="/account">
            Account
          </Link>
          <form action={signOut}>
            <button className="btn small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}

/** Red badge: trips in the next 3 days still needing a chauffeur. */
async function openTrips() {
  const today = todayKey();
  const r = schema.reservations;
  const rows = await db
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
  return rows.length;
}
