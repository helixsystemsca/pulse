import type { Metadata } from "next";
import { MessagesInboxApp } from "@/components/app/MessagesInboxApp";

export const metadata: Metadata = {
  title: "Messages",
  description: "Product feedback inbox for company administrators.",
};

export default function MessagesPage() {
  return <MessagesInboxApp />;
}
