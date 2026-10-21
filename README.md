# Livo

Reservations, dispatch and scheduling for chauffeured transportation. Piloting at MGL Limo.

Livo keeps the section layout Limo Anywhere operators already know (Dispatch, Reservations, Calendar, Driver schedule, Customers, Drivers, Vehicles) so switching over feels familiar.

## What works today

- **Dispatch board** — one day at a time. A timeline lane per driver shows shifts and trips, with a red line at the current time. Below it, every trip with inline status, driver and vehicle pickers. Filter to *Needs driver*, *In progress* or *Done & cancelled*.
- **Conflict checks** — flags a driver or vehicle booked on overlapping trips, a trip outside the driver's shift, and more passengers than the vehicle type seats.
- **Reservations** — book, edit and copy trips: billing account, passenger, service type (point to point, airport arrival/departure, hourly, round trip), stops, flight, vehicle type, assignment, rate with gratuity and extras, chauffeur and dispatch notes. "Use rate card" fills the base rate from the vehicle type. Every change is logged in the trip's history.
- **Reservation list** — search by conf #, passenger, company, address or flight; filter by date range and status; grouped by day with totals.
- **Calendar** — month view with trip counts and open trips per day; click a day to open it on dispatch, or **+** to book on that date.
- **Driver schedule** — week grid of shifts per driver, scheduled hours, trips per day, and trips that fall off shift. Add shifts (overnight shifts supported) and remove them.
- **Customers, Drivers, Vehicles** — add records; deactivate drivers; take vehicles out of service; vehicle types carry the rate card.

All times are entered and shown in the company time zone (`NEXT_PUBLIC_COMPANY_TZ`), no matter where the dispatcher's computer is.

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

`npm run setup` loads sample Bay Area data — 6 drivers, 7 vehicles, 8 accounts and about 120 trips around today's date, including one deliberate double-booking so you can see the conflict warnings. Names, phone numbers and rates are made up. Run `npm run db:seed` any time to reset it.

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
- Barlow typeface, self-hosted (SIL Open Font License, see `src/fonts/OFL.txt`)

## Where things live

```
src/
  app/
    actions.ts              all writes (server actions): book, edit, assign, status, shifts, records
    dispatch/               dispatch board + driver timeline
    reservations/           list, new, [id] detail/edit
    calendar/  schedule/    month view, weekly driver schedule
    customers/ drivers/ vehicles/
  components/               forms, dispatch controls, sidebar, shared UI
  db/
    schema.ts               data model (accounts, vehicle types, vehicles, drivers, shifts, reservations, events)
    seed.ts                 sample data
  lib/
    queries.ts              reads + conflict detection
    time.ts                 company-time-zone helpers (DST-safe)
    labels.ts               status/service labels, totals
drizzle/                    SQL migrations
```

Next.js 16 keeps recently visited pages alive in the background (React Activity), so forms are wrapped in `FreshAfterSubmit` to start clean after a successful save while keeping unsaved drafts.

## Not built yet

Logins and roles, chauffeur mobile app and live status from the field, payments and invoicing, customer-facing booking and confirmations by email/SMS, flight tracking, maps and drive-time estimates, affiliate farm-in/farm-out, reports, and the Limo Anywhere import for onboarding.
