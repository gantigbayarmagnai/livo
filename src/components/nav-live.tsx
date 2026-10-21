"use client";

import { usePathname } from "next/navigation";
import { sectionFor } from "@/lib/sections";
import { NavSections } from "./nav-sections";

export function NavLive({ counts }: { counts: Partial<Record<string, number>> }) {
  return <NavSections counts={counts} current={sectionFor(usePathname() ?? "")} />;
}
