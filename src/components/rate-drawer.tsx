"use client";

import { useEffect, useId, useState } from "react";
import { getRateCard } from "@/app/actions";
import { quote, type RateType } from "@/lib/pricing";

type T = RateType & { id: string };
const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** Quick rate lookup from the top bar, priced from the rate card. */
export function RateDrawer() {
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<T[] | null>(null);
  const [typeId, setTypeId] = useState("");
  const [service, setService] = useState<"airport_arrival" | "hourly">("airport_arrival");
  const [hours, setHours] = useState(3);
  const [time, setTime] = useState("14:00");
  const uid = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const show = async () => {
    setOpen((o) => !o);
    if (!types) {
      const list = (await getRateCard()) as T[];
      setTypes(list);
      setTypeId((cur) => cur || list[0]?.id || "");
    }
  };

  const type = types?.find((t) => t.id === typeId) ?? null;
  const q = quote({
    service,
    type,
    hours,
    outsideSf: false,
    meetGreet: "none",
    pickupTime: time,
    staffPrice: 0,
    tolls: 0,
  });

  return (
    <>
      <button type="button" className="tbtn" onClick={show} aria-expanded={open} title="Quick rate lookup">
        Rate
      </button>
      {open ? (
        <div className="drawer" role="dialog" aria-label="Quick rate lookup">
          <div className="confno">
            <h2>Quick rate lookup</h2>
            <button type="button" className="btn small" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {!types ? (
            <div className="skeleton" />
          ) : (
            <>
              <div className="field">
                <label htmlFor={`${uid}v`}>Vehicle</label>
                <select id={`${uid}v`} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="seg" role="radiogroup" aria-label="Service">
                <label>
                  <input
                    type="radio"
                    checked={service === "airport_arrival"}
                    onChange={() => setService("airport_arrival")}
                  />{" "}
                  SFO → SF
                </label>
                <label>
                  <input type="radio" checked={service === "hourly"} onChange={() => setService("hourly")} /> Hourly
                </label>
              </div>
              {service === "hourly" ? (
                <div className="field">
                  <label htmlFor={`${uid}h`}>Hours</label>
                  <input
                    id={`${uid}h`}
                    type="number"
                    min={1}
                    max={24}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                  />
                </div>
              ) : null}
              <div className="field">
                <label htmlFor={`${uid}t`}>Pickup time</label>
                <input id={`${uid}t`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="result" aria-live="polite">
                {q.staff ? "Not on rate card" : money(q.total)}
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {q.staff ?? q.lines.map((l) => `${l[0]}: ${money(l[1])}`).join(" · ")}
              </div>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
