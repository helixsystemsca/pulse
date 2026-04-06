import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Overview | Pulse" },
  description: "Pulse operational dashboard overview.",
};

export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-stealth-main">{children}</AppLayout>;
}
