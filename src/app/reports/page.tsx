import type { Metadata } from "next";
import { NotBuilt } from "@/components/ui";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <NotBuilt
      eyebrow="Reports"
      title="Reports"
      plan={["Revenue by vehicle, account and chauffeur.", "Trip counts and utilization by day and week."]}
    />
  );
}
