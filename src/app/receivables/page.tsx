import type { Metadata } from "next";
import { NotBuilt } from "@/components/ui";

export const metadata: Metadata = { title: "Receivables" };

export default function ReceivablesPage() {
  return (
    <NotBuilt
      eyebrow="Receivables"
      title="Invoices"
      plan={[
        "Settled trips roll into invoices by account.",
        "Card-on-file accounts are charged; monthly accounts get an open invoice.",
      ]}
    />
  );
}
