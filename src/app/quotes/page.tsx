import type { Metadata } from "next";
import { NotBuilt } from "@/components/not-built";

export const metadata: Metadata = { title: "Quotes" };

export default function QuotesPage() {
  return (
    <NotBuilt
      eyebrow="Quotes"
      title="Quote requests"
      plan={[
        "Requests from email and the website land here.",
        "Livo's AI reads each one, prices it from the rate card, lists what's missing and drafts the reply.",
        "A person approves before anything is booked or sent.",
      ]}
    />
  );
}
