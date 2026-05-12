import { AppLayout } from "@/components/app/AppLayout";
import { AmbientPageFrame } from "@/components/motion/AmbientPageFrame";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Schedule | Panorama" },
  description: "Shift calendar, personnel, and staffing for Pulse.",
};

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout
      mainClassName="bg-pulse-bg min-h-0"
      mainContentClassName="!min-h-0 flex w-full max-w-none flex-col bg-ds-bg px-3 py-4 lg:px-4"
    >
      <AmbientPageFrame>{children}</AmbientPageFrame>
    </AppLayout>
  );
}
