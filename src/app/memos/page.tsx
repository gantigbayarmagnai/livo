import type { Metadata } from "next";
import { NotBuilt } from "@/components/ui";

export const metadata: Metadata = { title: "Memos" };

export default function MemosPage() {
  return (
    <NotBuilt
      eyebrow="Memos"
      title="Company memos"
      plan={["Memos shown on the home page and the dispatch grid.", "Chauffeur standards and event-night notices."]}
    />
  );
}
