"use client";

import { AdminRealtimeProvider } from "@/components/admin/AdminRealtimeProvider";
import { FeatureAccessProvider } from "@/components/FeatureAccess";
import { PulseDashboardShell } from "@/components/dashboard/PulseDashboardShell";
import "@/app/admin/admin.css";

export default function WorkRequestsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureAccessProvider>
      <AdminRealtimeProvider>
        <PulseDashboardShell contentClassName="admin-content--cmms-wide">{children}</PulseDashboardShell>
      </AdminRealtimeProvider>
    </FeatureAccessProvider>
  );
}
