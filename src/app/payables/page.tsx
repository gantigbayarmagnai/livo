import type { Metadata } from "next";
import { NotBuilt } from "@/components/not-built";

export const metadata: Metadata = { title: "Payables" };

export default function PayablesPage() {
  return (
    <NotBuilt
      eyebrow="Payables"
      title="Driver payroll, agent and affiliate pay"
      plan={[
        "Hours from garage-in and garage-out times in the chauffeur app.",
        "Pay rules set per company in My Office.",
      ]}
    />
  );
}
