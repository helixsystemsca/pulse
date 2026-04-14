/**
 * Route group for in-app dashboards (e.g. Inspections & Logs under `/dashboard/compliance`).
 */
import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Dashboard | Pulse" },
  description: "Pulse operational dashboards.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-dashboard-canvas">{children}</AppLayout>;
}
