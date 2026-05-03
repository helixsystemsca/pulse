import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Schedule | Panorama" },
  description: "Shift calendar, personnel, and staffing for Pulse.",
};

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-pulse-bg">{children}</AppLayout>;
}
