"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminRealtimeProvider } from "@/components/admin/AdminRealtimeProvider";
import { FeatureAccessProvider } from "@/components/FeatureAccess";
import { PulseDashboardShell } from "@/components/dashboard/PulseDashboardShell";
import { bpEase, bpDuration, bpTransition } from "@/lib/motion-presets";
import "@/app/admin/admin.css";
import "./zones-devices.css";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export default function ZonesDevicesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isZones = pathname.startsWith("/zones-devices/zones") || pathname === "/zones-devices";
  const isBlueprint = pathname.startsWith("/zones-devices/blueprint");

  return (
    <FeatureAccessProvider>
      <AdminRealtimeProvider>
        <PulseDashboardShell contentClassName="admin-content--cmms-wide">
          <div className="zd-wrap">
            <motion.nav
              className="zd-tabs"
              aria-label="Zones and devices"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: bpDuration.med, ease: bpEase }}
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
                >
                  Blueprint
                </Link>
              </motion.span>
            </motion.nav>
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={bpTransition.med}
                style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </PulseDashboardShell>
      </AdminRealtimeProvider>
    </FeatureAccessProvider>
  );
}
