import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Operations | Pulse" },
  description: "Supervisor visibility for missed proximity, overdue work, and at-risk tasks.",
};

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-pulse-bg">{children}</AppLayout>;
}
