# Livo

Reservations, dispatch and scheduling for chauffeured transportation. Piloting at MGL Limo.

Livo uses Limo Anywhere's 14-section menu, in the same order, so switching over feels familiar. The design follows the Livo prototype: dark top bar, DM Sans with JetBrains Mono for times, conf numbers and money, one gold accent, light and dark mode.

## What works today

- **Dispatch** — the next 3 days with stat cards (trips today, need a driver, conflicts, booked today), flag chips on each trip (needs driver, driver or vehicle double-booked, outside shift, too many passengers, wrong vehicle type, price needed) and a chauffeur picker. Click a trip for its details, trip status, progress, vehicle and a copyable chauffeur brief.
- **Driver schedule** (tab in Dispatch) — a 3 AM → 3 AM timeline per chauffeur with shifts and trips, a now line, idle vehicles, and add/remove shifts.
- **Calendar** — Month, Week and Day views (Sunday start). Trips are colored by your own trip statuses; filter by driver (or unassigned), vehicle type, billing contact, service type, status and group; hover for a preview card; click to open and change the trip status; click a date for its day view. Non-reservation events (vehicle service, days off, notes) can be added, shown or hidden.
- **New Res/Quote** — priced live from MGL's 2026 rate card: SFO transfers, hourly with 3- or 6-hour minimums, Meet & Greet, late/early surcharge, tolls, staff price for anything not on the card. The server re-prices on save. Confirmation numbers continue Limo Anywhere's sequence.
- **Reservations** — New/Live, Quotes, Done, Cancelled and All tabs, global search by conf #, passenger, company, address or flight, full edit with change history.
- **My Office** — rate card, add-ons, and MGL's reservation statuses with colors (these color the calendar), plus Chauffeurs and Vehicles.
- **Accounts** — clients, affiliates and partners with trip counts.
- **Sign-in and roles** — three roles, checked on the server for every page and action:
  - **Owner:** everything, including Team, rates, status colors and revenue totals.
  - **Dispatcher:** reservations, dispatch, calendar, accounts and schedules. No settings, team or revenue totals.
  - **Chauffeur:** a phone-friendly *My trips* page with only their own trips (no prices) and one big button for the next step (On my way → On location → Passenger on board → Trip done).
- **Team** (My Office) — owners add people with a one-time temporary password, change roles, reset passwords and turn accounts off. New people must pick their own password on first sign-in. Reservation history shows who made each change.

Quotes (AI email intake), Network, Settle, Receivables, Payables, Reports, Memos, Files and Tools are in the menu with a short description of what goes there; they aren't built yet.

All times are entered and shown in the company time zone (`LIVO_COMPANY_TZ`), no matter where the dispatcher's computer is.

## Live deployment

Livo runs on Render at **app.getlivo.org**. Step-by-step setup is in [DEPLOY.md](DEPLOY.md).

## Run it on your Mac

You need **Node.js 20.12+** and **PostgreSQL 14+**. The simplest Postgres on a Mac is [Postgres.app](https://postgresapp.com).

```bash
# 1. Create the database
createdb livo

# 2. Configure
cp .env.example .env        # edit DATABASE_URL if your Postgres user isn't "livo"
                            # Postgres.app default: postgres://YOUR_MAC_USERNAME@localhost:5432/livo

# 3. Install, create tables, load sample data
npm install
npm run setup

# 4. Start
npm run dev                 # open http://localhost:3000
```

The sample data includes three demo sign-ins, all with the password `livo-demo-2026`:
`owner@livo.test`, `dispatch@livo.test` and `marco@livo.test` (a chauffeur).

On a real database (no seed), the first visit opens **Set up Livo**, where you create the owner account; add everyone else from My Office → Team. **Never run `npm run db:seed` on a live database** — it wipes everything.

### Security notes

- Passwords are hashed with scrypt; sign-ins are 30-day httpOnly cookies, stored hashed in the database.
- 5 wrong passwords lock an account for 15 minutes. Changing or resetting a password signs out the person's other devices.
- In production the cookie is HTTPS-only. To try a production build over plain HTTP on your own network, set `LIVO_INSECURE_COOKIES=1`.

`npm run setup` loads sample data: MGL's real rate card and fleet units (MGL01–MGL21), MGL's 12 trip statuses, and made-up chauffeurs, accounts and about 120 San Francisco trips around today's date, including one deliberate double-booking so you can see the conflict flags. Run `npm run db:seed` any time to reset it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Wipe and reload sample data |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Stack

- **Next.js 16** (App Router, Cache Components, Server Actions) with **TypeScript** and **Tailwind CSS 4**
- **PostgreSQL** via **Drizzle ORM** — pure TypeScript, no binary engine to download, SQL migrations checked in under `drizzle/`
- **Zod** validates every form on the server
- DM Sans and JetBrains Mono, self-hosted (SIL Open Font License, see `src/fonts/`)

## Where things live

```
src/
  app/
    actions.ts              all writes (server actions): book, edit, assign, statuses, events, shifts, records
    dispatch/               dispatch grid + driver schedule
    calendar/               month / week / day calendar
    reservations/           list, new, [id] detail/edit
    office/ accounts/ drivers/ vehicles/ team/
    login/ setup/ account/ my-trips/
    auth-actions.ts         sign-in, setup, passwords, team, chauffeur trip steps
    quotes/ network/ …      sections not built yet
  components/               top bar, calendar, dispatch board, forms, shared UI
  db/
    schema.ts               data model
    seed.ts                 sample data
  lib/
    auth.ts                 sessions, permission checks, lockout
    roles.ts                what each role can do
    pricing.ts              MGL rate-card rules (shared by form, rate lookup and server)
    queries.ts              reads + conflict detection
    time.ts                 company-time-zone helpers (DST-safe)
    sections.ts             the 14-section menu
drizzle/                    SQL migrations
```

Next.js 16 keeps recently visited pages alive in the background (React Activity), so forms are wrapped in `FreshAfterSubmit` to start clean after a successful save while keeping unsaved drafts.

## Not built yet

AI quote intake, chauffeur mobile app and live status, flight tracking, GNet / LA Net, settling, invoicing and payroll, reports, maps and drive-time estimates, and the Limo Anywhere import for onboarding.
