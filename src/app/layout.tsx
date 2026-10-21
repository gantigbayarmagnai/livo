import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { SidebarFrame } from "@/components/sidebar";
import { SidebarLive } from "@/components/sidebar-live";
import "./globals.css";

// Barlow takes its shapes from California highway signage (SIL Open Font License).
const barlow = localFont({
  variable: "--font-barlow",
  src: [
    { path: "../fonts/barlow-latin-400-normal.woff2", weight: "400" },
    { path: "../fonts/barlow-latin-500-normal.woff2", weight: "500" },
    { path: "../fonts/barlow-latin-600-normal.woff2", weight: "600" },
    { path: "../fonts/barlow-latin-700-normal.woff2", weight: "700" },
  ],
});
const barlowCond = localFont({
  variable: "--font-barlow-cond",
  src: [
    {
      path: "../fonts/barlow-semi-condensed-latin-500-normal.woff2",
      weight: "500",
    },
    {
      path: "../fonts/barlow-semi-condensed-latin-600-normal.woff2",
      weight: "600",
    },
    {
      path: "../fonts/barlow-semi-condensed-latin-700-normal.woff2",
      weight: "700",
    },
  ],
});

export const metadata: Metadata = {
  title: { default: "Livo", template: "%s · Livo" },
  description: "Reservations, dispatch and scheduling for chauffeured transportation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCond.variable} antialiased`}>
      <body className="min-h-dvh md:flex">
        <Suspense fallback={<SidebarFrame path="" />}>
          <SidebarLive />
        </Suspense>
        <main className="min-w-0 flex-1">{children}</main>
      </body>
    </html>
  );
}
