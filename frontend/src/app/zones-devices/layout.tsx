"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminRealtimeProvider } from "@/components/admin/AdminRealtimeProvider";
import { FeatureAccessProvider } from "@/components/FeatureAccess";
import { PulseDashboardShell } from "@/components/dashboard/PulseDashboardShell";
import "@/app/admin/admin.css";
import "./zones-devices.css";

export default function ZonesDevicesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isZones = pathname.startsWith("/zones-devices/zones") || pathname === "/zones-devices";
  const isBlueprint = pathname.startsWith("/zones-devices/blueprint");

  return (
    <FeatureAccessProvider>
      <AdminRealtimeProvider>
        <PulseDashboardShell contentClassName="admin-content--cmms-wide">
          <div className="zd-wrap">
            <nav className="zd-tabs" aria-label="Zones and devices">
              <Link
                href="/zones-devices/zones"
                className={`zd-tab ${isZones ? "is-active" : ""}`}
                prefetch={false}
              >
                Zones
              </Link>
              <Link
                href="/zones-devices/blueprint"
                className={`zd-tab ${isBlueprint ? "is-active" : ""}`}
                prefetch={false}
              >
                Blueprint
              </Link>
            </nav>
            {children}
          </div>
        </PulseDashboardShell>
      </AdminRealtimeProvider>
    </FeatureAccessProvider>
  );
}
