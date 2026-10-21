import type { Metadata } from "next";
import { Suspense } from "react";
import { TripSteps } from "@/components/trip-steps";
import { Loading, StatusChip, ViewHead } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { SERVICE_LABELS } from "@/lib/labels";
import { MEET_GREET, type MeetGreet } from "@/lib/pricing";
import { listReservations } from "@/lib/queries";
import { addDays, formatDayKey, hhmm, toDateKey, todayKey, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "My trips" };

export default function MyTripsPage() {
  return (
    <>
      <ViewHead
        eyebrow="Chauffeur"
        title="My trips"
        desc="Today and the next 6 days. Tap the button as each step happens."
      />
      <Suspense fallback={<Loading rows={4} />}>
        <Trips />
      </Suspense>
    </>
  );
}

async function Trips() {
  const me = await requirePage("myTrips");
  if (!me.driverId) {
    return (
      <p className="staff">
        Your account isn’t linked to a chauffeur record yet. Ask the office to link it in My Office → Team.
      </p>
    );
  }
  const today = todayKey();
  const rows = await listReservations({
    from: zonedToUtc(today),
    to: zonedToUtc(addDays(today, 7)),
    driverId: me.driverId,
  });
  // Chauffeurs see their trip details, never prices or billing.
  const trips = rows.filter((x) => !["cancelled", "quote"].includes(x.r.status));
  if (!trips.length) return <div className="panel empty">No trips assigned to you this week.</div>;

  const days = [...new Set(trips.map((x) => toDateKey(x.r.pickupAt)))];
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      {days.map((day) => (
        <section key={day} className="stack" style={{ gap: 10 }} aria-label={formatDayKey(day)}>
          <div className="day" style={{ borderRadius: 8 }}>
            {day === today ? "Today · " : day === addDays(today, 1) ? "Tomorrow · " : ""}
            {formatDayKey(day, { weekday: "short", month: "short", day: "numeric" })}
          </div>
          {trips
            .filter((x) => toDateKey(x.r.pickupAt) === day)
            .map(({ r, vehicle, vehicleType }) => (
              <article
                key={r.id}
                className="trip-card"
                style={r.status === "done" || r.status === "no_show" ? { opacity: 0.6 } : undefined}
              >
                <div className="confno" style={{ marginBottom: 0 }}>
                  <span className="when">{hhmm(r.pickupAt)}</span>
                  <StatusChip status={r.status} />
                </div>
                <div>
                  <b>{r.passengerName}</b>
                  <span className="muted">
                    {" "}
                    · {r.passengerCount} pax
                    {r.luggageCount ? `, ${r.luggageCount} bag${r.luggageCount === 1 ? "" : "s"}` : ""}
                  </span>
                  {r.passengerPhone ? (
                    <div>
                      <a href={`tel:${r.passengerPhone.replace(/[^\d+]/g, "")}`}>{r.passengerPhone}</a>
                    </div>
                  ) : null}
                </div>
                <dl className="kv">
                  <dt>Conf #</dt>
                  <dd className="mono">{r.confNumber}</dd>
                  <dt>Service</dt>
                  <dd>
                    {SERVICE_LABELS[r.serviceType]}
                    {r.serviceType === "hourly" ? ` · ${Math.round((r.estDurationMin / 60) * 10) / 10} hrs` : ""}
                  </dd>
                  <dt>Vehicle</dt>
                  <dd>{vehicle?.id ? vehicle.name : (vehicleType?.name ?? "—")}</dd>
                  {r.flightNumber ? (
                    <>
                      <dt>Flight</dt>
                      <dd>{r.flightNumber}</dd>
                    </>
                  ) : null}
                  {r.serviceType === "airport_arrival" ? (
                    <>
                      <dt>Meeting</dt>
                      <dd>{MEET_GREET[r.meetGreet as MeetGreet]?.label}</dd>
                    </>
                  ) : null}
                  <dt>Pickup</dt>
                  <dd>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(r.pickupAddress)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.pickupAddress}
                    </a>
                  </dd>
                  {r.stops.map((s, i) => (
                    <div key={i} style={{ display: "contents" }}>
                      <dt>Stop</dt>
                      <dd>{s}</dd>
                    </div>
                  ))}
                  <dt>Drop-off</dt>
                  <dd>
                    {r.dropoffAddress ? (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(r.dropoffAddress)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.dropoffAddress}
                      </a>
                    ) : (
                      "As directed"
                    )}
                  </dd>
                  {r.customerNotes ? (
                    <>
                      <dt>Notes</dt>
                      <dd>{r.customerNotes}</dd>
                    </>
                  ) : null}
                </dl>
                {day === today || day === addDays(today, 1) ? <TripSteps id={r.id} status={r.status} /> : null}
              </article>
            ))}
        </section>
      ))}
      <p className="muted" style={{ fontSize: 12.5 }}>
        Issues: call or text 415.699.3138, 24/7. Never discuss billing, wait time or extra stops with the client.
      </p>
    </div>
  );
}
