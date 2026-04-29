import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Overview | Pulse" },
  description: "Pulse operational dashboard overview.",
};

export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout
      mainClassName="bg-pulse-bg"
      pageShell={false}
      mainContentClassName="flex min-h-0 w-full flex-1 flex-col !p-0"
    >
      {children}
    </AppLayout>
  );
}
