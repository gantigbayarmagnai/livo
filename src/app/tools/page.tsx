import type { Metadata } from "next";
import { NotBuilt } from "@/components/ui";

export const metadata: Metadata = { title: "Tools" };

export default function ToolsPage() {
  return (
    <NotBuilt
      eyebrow="Tools"
      title="Print queue"
      plan={["Trip sheets for tomorrow's chauffeurs.", "Bulk actions and data import from Limo Anywhere."]}
    />
  );
}
