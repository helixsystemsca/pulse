"use client";

import { AdminRealtimeProvider } from "@/components/admin/AdminRealtimeProvider";
import { FeatureAccessProvider } from "@/components/FeatureAccess";
import { PulseDashboardShell } from "@/components/dashboard/PulseDashboardShell";
import "./admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureAccessProvider>
      <AdminRealtimeProvider>
        <PulseDashboardShell>{children}</PulseDashboardShell>
      </AdminRealtimeProvider>
    </FeatureAccessProvider>
  );
}
