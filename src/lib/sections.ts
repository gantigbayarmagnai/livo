/** Limo Anywhere's menu, in Limo Anywhere's order, so operators feel at home. */
export const SECTIONS = [
  { id: "office", label: "My Office", href: "/office" },
  { id: "accounts", label: "Accounts", href: "/accounts" },
  { id: "quotes", label: "Quotes", href: "/quotes" },
  { id: "calendar", label: "Calendar", href: "/calendar" },
  { id: "reservations", label: "Reservations", href: "/reservations" },
  { id: "dispatch", label: "Dispatch", href: "/dispatch" },
  { id: "network", label: "Network", href: "/network" },
  { id: "settle", label: "Settle", href: "/settle" },
  { id: "receivables", label: "Receivables", href: "/receivables" },
  { id: "payables", label: "Payables", href: "/payables" },
  { id: "reports", label: "Reports", href: "/reports" },
  { id: "memos", label: "Memos", href: "/memos" },
  { id: "files", label: "Files", href: "/files" },
  { id: "tools", label: "Tools", href: "/tools" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

/** Which section a path belongs to (driver/vehicle records live under My Office). */
export function sectionFor(path: string): SectionId | null {
  if (path.startsWith("/drivers") || path.startsWith("/vehicles") || path.startsWith("/team")) return "office";
  if (path.startsWith("/reservations")) return "reservations";
  const hit = SECTIONS.find((s) => path === s.href || path.startsWith(s.href + "/"));
  return hit?.id ?? null;
}
