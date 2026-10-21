"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** Prev / Today / Next plus a date picker, driven by ?date= on the given path. */
export function DateNav({
  path,
  date,
  prev,
  next,
  today,
  extra = "",
  unit = "day",
}: {
  path: string;
  date: string;
  prev: string;
  next: string;
  today: string;
  extra?: string;
  unit?: "day" | "week" | "month";
}) {
  const router = useRouter();
  const href = (d: string) => `${path}?date=${d}${extra}`;
  return (
    <div className="flex items-center gap-1.5">
      <Link className="btn px-2.5" href={href(prev)} aria-label={`Previous ${unit}`}>
        ‹
      </Link>
      <Link className="btn" href={href(today)} aria-current={date === today ? "date" : undefined}>
        Today
      </Link>
      <Link className="btn px-2.5" href={href(next)} aria-label={`Next ${unit}`}>
        ›
      </Link>
      <input
        type="date"
        aria-label="Go to date"
        className="field w-auto py-1.5"
        value={date}
        onChange={(e) => e.target.value && router.push(href(e.target.value))}
      />
    </div>
  );
}
