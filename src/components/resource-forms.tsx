"use client";

import { useActionState, useEffect, useRef, useTransition, type ReactNode } from "react";
import type { FormState } from "@/app/actions";
import { FreshAfterSubmit, useMarkSubmitted } from "./fresh-after-submit";

type InlineProps = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: ReactNode;
  submitLabel: string;
  savedLabel: string;
};

/** Small inline "add" form: shows errors, clears itself after success. */
export function InlineForm(props: InlineProps) {
  return (
    <FreshAfterSubmit>
      <Inline {...props} />
    </FreshAfterSubmit>
  );
}

function Inline({ action, children, submitLabel, savedLabel }: InlineProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const markSubmitted = useMarkSubmitted();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} onSubmit={() => markSubmitted(true)} className="flex flex-wrap items-end gap-3">
      {children}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
      <p aria-live="polite" className="basis-full text-[14px] font-semibold empty:hidden">
        {state.error ? (
          <span className="text-stop">{state.error}</span>
        ) : state.ok && !pending ? (
          <span className="text-route-ink">{savedLabel}</span>
        ) : null}
      </p>
    </form>
  );
}

/** A button that runs a server action with no form fields. */
export function ActionButton({
  run,
  children,
  className = "btn",
  label,
}: {
  run: () => Promise<void>;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className={className} aria-label={label} disabled={pending} onClick={() => start(run)}>
      {children}
    </button>
  );
}
