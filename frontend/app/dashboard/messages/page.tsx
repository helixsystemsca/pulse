import type { Metadata } from "next";
import { MessagesInboxApp } from "@/components/app/MessagesInboxApp";

export const metadata: Metadata = {
  title: "Messages",
  description: "Personal operational inbox; administrators also have a Product feedback tab.",
};

export default function MessagesPage() {
  return <MessagesInboxApp />;
}
