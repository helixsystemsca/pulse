"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { bpEase, bpDuration } from "@/lib/motion-presets";

export function ZonesDevicesChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isZones = pathname.startsWith("/zones-devices/zones") || pathname === "/zones-devices";
  const isBlueprint = pathname.startsWith("/zones-devices/blueprint");

  const tabClass = (active: boolean) =>
    `rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
      active
        ? "bg-white text-pulse-navy shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600"
        : "text-pulse-muted hover:bg-white/60 hover:text-pulse-navy dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
    }`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <p className="m-0 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-pulse-muted">
          Zones &amp; floor plans
        </p>
        <nav
          className="mt-2 inline-flex gap-1 rounded-xl border border-pulse-border bg-white/70 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900/50"
          aria-label="Zones and blueprints"
        >
          <Link
            href="/zones-devices/zones"
            className={tabClass(isZones)}
            prefetch={false}
            aria-current={isZones ? "page" : undefined}
          >
            Zones
          </Link>
          <Link
            href="/zones-devices/blueprint"
            className={tabClass(isBlueprint)}
            prefetch={false}
            aria-current={isBlueprint ? "page" : undefined}
          >
            Blueprint designer
          </Link>
        </nav>
      </div>
      <motion.div
        key={pathname}
        className="flex min-h-0 flex-1 flex-col"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.med, ease: bpEase }}
      >
        {children}
      </motion.div>
    </div>
  );
}
