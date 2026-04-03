"use client";

import { AdminRealtimeProvider } from "@/components/admin/AdminRealtimeProvider";
import { FeatureAccessProvider } from "@/components/FeatureAccess";
import { PulseDashboardShell } from "@/components/dashboard/PulseDashboardShell";
import "@/app/admin/admin.css";

export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureAccessProvider>
      <AdminRealtimeProvider>
        <PulseDashboardShell contentClassName="admin-content--cmms-wide">{children}</PulseDashboardShell>
      </AdminRealtimeProvider>
    </FeatureAccessProvider>
  );
}
