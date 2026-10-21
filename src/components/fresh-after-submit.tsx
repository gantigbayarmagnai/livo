"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Next.js keeps recently visited pages mounted but hidden (React Activity),
 * so a submitted form would still show old values and messages when you come
 * back to it. Wrap a form in this: once it has been submitted, it remounts
 * fresh the next time its page is hidden. Unsubmitted drafts are kept.
 */
const Ctx = createContext<(submitted: boolean) => void>(() => {});

export function FreshAfterSubmit({ children }: { children: ReactNode }) {
  const [gen, setGen] = useState(0);
  const submitted = useRef(false);
  useLayoutEffect(
    () => () => {
      if (submitted.current) {
        submitted.current = false;
        setGen((g) => g + 1);
      }
    },
    [],
  );
  return (
    <Ctx.Provider value={(v) => (submitted.current = v)}>
      <div key={gen} className="contents">
        {children}
      </div>
    </Ctx.Provider>
  );
}

export const useMarkSubmitted = () => useContext(Ctx);
