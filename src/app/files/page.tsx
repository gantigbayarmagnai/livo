import type { Metadata } from "next";
import { NotBuilt } from "@/components/not-built";

export const metadata: Metadata = { title: "Files" };

export default function FilesPage() {
  return (
    <NotBuilt
      eyebrow="Files"
      title="Files to attach to emails"
      plan={[
        "Rate card, terms and conditions, chauffeur standards.",
        "Attached automatically to quote replies, confirmations and briefs.",
      ]}
    />
  );
}
