import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Schedule | Panorama" },
  description: "Shift calendar, personnel, and staffing for Pulse.",
};

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout
      mainClassName="bg-pulse-bg !min-h-0 !overflow-hidden"
      mainContentClassName="flex h-full min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden bg-ds-bg px-3 py-4 lg:px-4"
    >
      {children}
    </AppLayout>
  );
}
