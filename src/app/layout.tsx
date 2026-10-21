import type { Metadata } from "next";
import localFont from "next/font/local";
import { TopBar } from "@/components/top-bar";
import "./globals.css";

// DM Sans for the interface, JetBrains Mono for times, conf numbers and money
// (both SIL Open Font License, self-hosted).
const dmSans = localFont({
  variable: "--font-dm-sans",
  src: [
    { path: "../fonts/dm-sans-latin-400-normal.woff2", weight: "400" },
    { path: "../fonts/dm-sans-latin-500-normal.woff2", weight: "500" },
    { path: "../fonts/dm-sans-latin-600-normal.woff2", weight: "600" },
    { path: "../fonts/dm-sans-latin-700-normal.woff2", weight: "700" },
  ],
});
const jetbrains = localFont({
  variable: "--font-jetbrains",
  src: [
    { path: "../fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../fonts/jetbrains-mono-latin-600-normal.woff2", weight: "600" },
  ],
});

export const metadata: Metadata = {
  title: { default: "Livo", template: "%s · Livo" },
  description: "Reservations, dispatch and scheduling for chauffeured transportation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrains.variable}`}>
      <body>
        <TopBar />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
