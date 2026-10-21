import Link from "next/link";

// Same section order Limo Anywhere operators are used to, ops first.
const groups = [
  {
    name: "Operations",
    items: [
      { href: "/dispatch", label: "Dispatch" },
      { href: "/reservations", label: "Reservations" },
      { href: "/calendar", label: "Calendar" },
      { href: "/schedule", label: "Driver schedule" },
    ],
  },
  {
    name: "Records",
    items: [
      { href: "/customers", label: "Customers" },
      { href: "/drivers", label: "Drivers" },
      { href: "/vehicles", label: "Vehicles" },
    ],
  },
];

/** Renders the nav; `path` marks the current section (empty while streaming). */
export function SidebarFrame({ path }: { path: string }) {
  const company = process.env.NEXT_PUBLIC_COMPANY_NAME || "Your company";
  return (
    <nav
      aria-label="Main"
      className="bg-asphalt text-white md:sticky md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:px-5 md:pb-6 md:pt-5">
        <Link href="/dispatch" className="block">
          <span className="font-cond text-[26px] font-bold leading-none tracking-tight">Livo</span>
          <span className="mt-1 hidden text-[13px] text-white/55 md:block">{company}</span>
        </Link>
        <Link href="/reservations/new" className="btn btn-primary md:mt-5 md:w-full md:justify-center">
          New reservation
        </Link>
      </div>
      <div className="flex gap-1 overflow-x-auto px-2 pb-2 md:block md:space-y-5 md:overflow-visible md:px-3">
        {groups.map((g) => (
          <div key={g.name} className="flex gap-1 md:block md:space-y-0.5">
            <p className="hidden px-2 pb-1 text-[12px] text-white/40 md:block">{g.name}</p>
            {g.items.map((it) => {
              const active = !!path && (path === it.href || path.startsWith(it.href + "/"));
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`block whitespace-nowrap rounded-md px-2 py-1.5 text-[15px] ${
                    active
                      ? "bg-asphalt-2 font-semibold text-white shadow-[inset_3px_0_0_var(--route)]"
                      : "text-white/75 hover:bg-asphalt-2 hover:text-white"
                  }`}
                >
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
