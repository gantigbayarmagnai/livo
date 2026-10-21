import Link from "next/link";
import { SECTIONS, type SectionId } from "@/lib/sections";

/** The 14-section bar. `current` is null while the page streams in. */
export function NavSections({ counts, current }: { counts: Partial<Record<string, number>>; current: SectionId | null }) {
  return (
    <div className="wrap inner">
      {SECTIONS.map((s) => (
        <Link key={s.id} href={s.href} className="sec" aria-current={s.id === current ? "page" : undefined}>
          {s.label}
          {counts[s.id] ? (
            <span className="count" aria-label={`${counts[s.id]} need attention`}>
              {counts[s.id]}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
