"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { addUser, resetUserPassword, setUserActive, setUserRole, type AuthState } from "@/app/auth-actions";
import type { UserRole } from "@/db/schema";
import { ROLE_HELP, ROLE_LABELS } from "@/lib/roles";
import { FreshAfterSubmit } from "./fresh-after-submit";

type Member = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  driverId: string | null;
  active: boolean;
  mustChangePassword: boolean;
  lastLogin: string | null;
  locked: boolean;
};
type Driver = { id: string; name: string };

/** Shows a temporary password once, so the owner can pass it on. */
function TempPassword({ state }: { state: AuthState }) {
  if (!state.tempPassword) return null;
  return (
    <div className="okbox" role="status" style={{ display: "grid", gap: 6 }}>
      <span>
        Temporary password for {state.forEmail}. Give it to them in person or by text; they’ll pick their own when they
        sign in. It won’t be shown again.
      </span>
      <span className="secret">{state.tempPassword}</span>
    </div>
  );
}

export function AddMember({ drivers }: { drivers: Driver[] }) {
  return (
    <FreshAfterSubmit>
      <AddMemberForm drivers={drivers} />
    </FreshAfterSubmit>
  );
}

function AddMemberForm({ drivers }: { drivers: Driver[] }) {
  const [state, action, pending] = useActionState(addUser, {});
  const [role, setRole] = useState<UserRole>("dispatcher");
  const id = useId();
  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <div className="inline-form">
        <div className="field">
          <label htmlFor={`${id}n`}>Name</label>
          <input id={`${id}n`} name="name" required />
        </div>
        <div className="field">
          <label htmlFor={`${id}e`}>Email</label>
          <input id={`${id}e`} name="email" type="email" required />
        </div>
        <div className="field">
          <label htmlFor={`${id}r`}>Role</label>
          <select id={`${id}r`} name="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {role === "chauffeur" ? (
          <div className="field">
            <label htmlFor={`${id}d`}>Chauffeur record</label>
            <select id={`${id}d`} name="driverId" required>
              <option value="">Choose…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add to team"}
        </button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
        {ROLE_HELP[role]}
      </p>
      {state.error ? (
        <p role="alert" className="errbox" style={{ margin: 0 }}>
          {state.error}
        </p>
      ) : null}
      <TempPassword state={state} />
    </form>
  );
}

export function MemberRow({ m, isMe, drivers }: { m: Member; isMe: boolean; drivers: Driver[] }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AuthState>({});
  const [role, setRole] = useState<UserRole>(m.role);
  const [driverId, setDriverId] = useState(m.driverId ?? "");
  const run = (fn: () => Promise<AuthState>) => start(async () => setResult(await fn()));
  const id = useId();
  const changed = role !== m.role || (role === "chauffeur" && driverId !== (m.driverId ?? ""));
  return (
    <>
      <tr className={m.active ? "" : "muted"}>
        <td>
          <b>{m.name}</b>
          {isMe ? <span className="muted"> (you)</span> : null}
          <div className="muted" style={{ fontSize: 12.5 }}>
            {m.email}
          </div>
        </td>
        <td>
          <label htmlFor={`${id}r`} className="sr-only">
            Role for {m.name}
          </label>
          <select
            id={`${id}r`}
            className="select-sm"
            style={{ width: "auto" }}
            value={role}
            disabled={isMe || pending}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {role === "chauffeur" ? (
            <select
              aria-label={`Chauffeur record for ${m.name}`}
              className="select-sm"
              style={{ width: "auto", marginLeft: 6 }}
              value={driverId}
              disabled={pending}
              onChange={(e) => setDriverId(e.target.value)}
            >
              <option value="">Choose…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : null}
          {changed ? (
            <button
              type="button"
              className="btn small"
              style={{ marginLeft: 6 }}
              disabled={pending}
              onClick={() => run(() => setUserRole(m.id, role, role === "chauffeur" ? driverId || null : null))}
            >
              Save role
            </button>
          ) : null}
        </td>
        <td>
          {!m.active ? (
            <span className="chip plain">Turned off</span>
          ) : m.locked ? (
            <span className="chip crit">Locked out</span>
          ) : m.mustChangePassword ? (
            <span className="chip warn">Temporary password</span>
          ) : (
            <span className="chip good">Active</span>
          )}
        </td>
        <td className="muted">{m.lastLogin ?? "Never"}</td>
        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {!isMe ? (
            <>
              <button
                type="button"
                className="btn small"
                disabled={pending}
                onClick={() => run(() => resetUserPassword(m.id))}
              >
                Reset password
              </button>{" "}
              <button
                type="button"
                className="btn small"
                disabled={pending}
                onClick={() => run(() => setUserActive(m.id, !m.active))}
              >
                {m.active ? "Turn off" : "Turn on"}
              </button>
            </>
          ) : null}
        </td>
      </tr>
      {result.error || result.tempPassword ? (
        <tr>
          <td colSpan={5}>
            {result.error ? (
              <p role="alert" className="errbox" style={{ margin: 0 }}>
                {result.error}
              </p>
            ) : (
              <TempPassword state={result} />
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
