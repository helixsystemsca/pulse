/**
 * Route group for in-app dashboards (e.g. Inspections & Logs under `/dashboard/compliance`).
 */
import { AppLayout } from "@/components/app/AppLayout";
import { AmbientPageFrame } from "@/components/motion/AmbientPageFrame";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Dashboard | Helix" },
  description: "Helix operational dashboards.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-[#f5f7fb] dark:bg-ds-bg">
      <AmbientPageFrame>{children}</AmbientPageFrame>
    </AppLayout>
  );
}
