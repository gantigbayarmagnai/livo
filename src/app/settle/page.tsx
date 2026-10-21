import type { Metadata } from "next";
import { NotBuilt } from "@/components/ui";

export const metadata: Metadata = { title: "Settle" };

export default function SettlePage() {
  return (
    <NotBuilt
      eyebrow="Settle"
      title="Completed trips"
      plan={[
        "Check extras from the chauffeur's report (overtime, parking, tolls).",
        "Settle each trip to send it to Receivables.",
      ]}
    />
  );
}
