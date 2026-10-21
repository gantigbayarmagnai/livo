import type { Metadata } from "next";
import { NotBuilt } from "@/components/not-built";

export const metadata: Metadata = { title: "Network" };

export default function NetworkPage() {
  return (
    <NotBuilt
      eyebrow="Network"
      title="Affiliate networks"
      plan={[
        "GNet two-way farm-in and farm-out with status updates.",
        "LA Net trips synced in while MGL keeps a Limo Anywhere account for LA Net during the pilot.",
        "Affiliate list with direction and contact.",
      ]}
    />
  );
}
