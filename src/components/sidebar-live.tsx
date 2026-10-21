"use client";

import { usePathname } from "next/navigation";
import { SidebarFrame } from "./sidebar";

export function SidebarLive() {
  return <SidebarFrame path={usePathname()} />;
}
