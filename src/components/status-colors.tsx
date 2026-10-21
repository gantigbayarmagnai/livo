"use client";

import { useState, useTransition } from "react";
import { setTripStatusColor } from "@/app/actions";
import type { TripStatus } from "@/db/schema";

/** Each trip status with its color, as in Limo Anywhere. Colors save as you pick them. */
export function StatusColors({ statuses }: { statuses: TripStatus[] }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {statuses.map((s) => (
        <StatusRow key={s.id} s={s} />
      ))}
    </div>
  );
}

function StatusRow({ s }: { s: TripStatus }) {
  const [color, setColor] = useState(s.color ?? "#999999");
  const [none, setNone] = useState(!s.color);
  const [pending, start] = useTransition();
  const save = (c: string | null) => start(() => setTripStatusColor(s.id, c));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: pending ? 0.6 : 1 }}>
      <input
        type="color"
        value={color}
        aria-label={`Color for ${s.name}`}
        style={{
          opacity: none ? 0.35 : 1,
          width: 34,
          height: 26,
          padding: 0,
          border: "1px solid var(--line)",
          borderRadius: 6,
          background: "none",
        }}
        onChange={(e) => {
          setColor(e.target.value);
          setNone(false);
        }}
        onBlur={() => !none && color !== s.color && save(color)}
      />
      <span style={{ flex: 1, minWidth: 0 }}>{s.name}</span>
      <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 4, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={none}
          onChange={(e) => {
            setNone(e.target.checked);
            save(e.target.checked ? null : color);
          }}
        />{" "}
        No color
      </label>
    </div>
  );
}
