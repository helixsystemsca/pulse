"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminRealtimeProvider } from "@/components/admin/AdminRealtimeProvider";
import { FeatureAccessProvider } from "@/components/FeatureAccess";
import { PulseDashboardShell } from "@/components/dashboard/PulseDashboardShell";
import { bpTransition } from "@/lib/motion-presets";
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
            <p className="zd-section-kicker">Zones &amp; Devices</p>
            <motion.nav
              className="zd-tabs"
              aria-label="Zones and devices"
              initial={false}
            >
              <motion.span
                className="zd-tab-anim"
                whileHover={{ scale: 1.02, filter: "brightness(1.08)" }}
                whileTap={{ scale: 0.985 }}
                transition={bpTransition.fast}
              >
                <Link
                  href="/zones-devices/zones"
                  className={`zd-tab ${isZones ? "is-active" : ""}`}
                  prefetch={false}
                  aria-current={isZones ? "page" : undefined}
                >
                  Zones
                </Link>
              </motion.span>
              <motion.span
                className="zd-tab-anim"
                whileHover={{ scale: 1.02, filter: "brightness(1.08)" }}
                whileTap={{ scale: 0.985 }}
                transition={bpTransition.fast}
              >
                <Link
                  href="/zones-devices/blueprint"
                  className={`zd-tab ${isBlueprint ? "is-active" : ""}`}
                  prefetch={false}
                  aria-current={isBlueprint ? "page" : undefined}
                >
                  Blueprint designer
                </Link>
              </motion.span>
            </motion.nav>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={bpTransition.med}
              style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
            >
              {children}
            </motion.div>
          </div>
        </PulseDashboardShell>
      </AdminRealtimeProvider>
    </FeatureAccessProvider>
  );
}
