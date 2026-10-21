import Link from "next/link";

const TABS = [
  { href: "/office", label: "Rates and statuses" },
  { href: "/drivers", label: "Chauffeurs" },
  { href: "/vehicles", label: "Vehicles" },
];

export function OfficeTabs({ current }: { current: string }) {
  return (
    <div className="subtabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="subtab" aria-current={t.href === current ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
