"use client";

import { useActionState, useId } from "react";
import { changePassword, setupOwner, signIn, type AuthState } from "@/app/auth-actions";

function Err({ state }: { state: AuthState }) {
  return state.error ? (
    <p role="alert" className="errbox" style={{ margin: 0 }}>
      {state.error}
    </p>
  ) : null;
}

export function SignInForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(signIn, {});
  const id = useId();
  return (
    <form action={action} className="panel">
      <Err state={state} />
      <div className="field">
        <label htmlFor={`${id}e`}>Email</label>
        <input
          id={`${id}e`}
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          defaultValue={state.email}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}p`}>Password</label>
        <input id={`${id}p`} name="password" type="password" autoComplete="current-password" required />
      </div>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <button className="btn primary" type="submit" disabled={pending} style={{ justifyContent: "center" }}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
        Forgot your password? Ask the owner to reset it from My Office → Team.
      </p>
    </form>
  );
}

export function SetupForm({ min, needsCode }: { min: number; needsCode: boolean }) {
  const [state, action, pending] = useActionState(setupOwner, {});
  const id = useId();
  return (
    <form action={action} className="panel">
      <Err state={state} />
      {needsCode ? (
        <div className="field">
          <label htmlFor={`${id}s`}>Setup code</label>
          <input id={`${id}s`} name="setupCode" autoComplete="off" required aria-describedby={`${id}sh`} />
          <span id={`${id}sh`} className="muted" style={{ fontSize: 12 }}>
            In Render: your livo service → Environment → LIVO_SETUP_CODE.
          </span>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={`${id}n`}>Your name</label>
        <input id={`${id}n`} name="name" autoComplete="name" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor={`${id}e`}>Email</label>
        <input id={`${id}e`} name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor={`${id}p`}>Password</label>
        <input
          id={`${id}p`}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={min}
          required
          aria-describedby={`${id}ph`}
        />
        <span id={`${id}ph`} className="muted" style={{ fontSize: 12 }}>
          At least {min} characters. A short phrase is easiest to remember.
        </span>
      </div>
      <div className="field">
        <label htmlFor={`${id}c`}>Next confirmation number</label>
        <input
          id={`${id}c`}
          name="nextConf"
          type="number"
          min={2}
          placeholder="e.g. 81327"
          aria-describedby={`${id}ch`}
        />
        <span id={`${id}ch`} className="muted" style={{ fontSize: 12 }}>
          Optional. Use the next number from Limo Anywhere so confirmation numbers carry on.
        </span>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5 }}>
        <input
          type="checkbox"
          name="mglDefaults"
          defaultChecked
          style={{ marginTop: 3, accentColor: "var(--accent)" }}
        />
        <span>
          Start with MGL’s 2026 rate card, trip statuses and fleet units (MGL01–MGL21)
          <span className="muted" style={{ display: "block", fontSize: 12 }}>
            You can change all of it later in My Office.
          </span>
        </span>
      </label>
      <button className="btn primary" type="submit" disabled={pending} style={{ justifyContent: "center" }}>
        {pending ? "Setting up…" : "Create owner account"}
      </button>
    </form>
  );
}

export function ChangePasswordForm({ min, first }: { min: number; first: boolean }) {
  const [state, action, pending] = useActionState(changePassword, {});
  const id = useId();
  return (
    <form action={action} className="panel" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>{first ? "Choose your own password" : "Change password"}</h2>
      {first ? (
        <p className="staff" style={{ margin: 0 }}>
          You signed in with a temporary password. Pick your own to continue.
        </p>
      ) : null}
      <Err state={state} />
      {state.ok ? (
        <p role="status" className="okbox" style={{ margin: 0 }}>
          Password changed. Other devices were signed out.
        </p>
      ) : null}
      <div className="field">
        <label htmlFor={`${id}c`}>{first ? "Temporary password" : "Current password"}</label>
        <input id={`${id}c`} name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor={`${id}p`}>New password</label>
        <input id={`${id}p`} name="password" type="password" autoComplete="new-password" minLength={min} required />
        <span className="muted" style={{ fontSize: 12 }}>
          At least {min} characters.
        </span>
      </div>
      <div className="field">
        <label htmlFor={`${id}k`}>New password again</label>
        <input id={`${id}k`} name="confirm" type="password" autoComplete="new-password" required />
      </div>
      <div>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save new password"}
        </button>
      </div>
    </form>
  );
}
