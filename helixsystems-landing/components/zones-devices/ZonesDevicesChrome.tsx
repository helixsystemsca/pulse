"use client";

import { motion } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { bpEase, bpDuration } from "@/lib/motion-presets";

export function ZonesDevicesChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isZones = pathname.startsWith("/zones-devices/zones") || pathname === "/zones-devices";
  const isBlueprint = pathname.startsWith("/zones-devices/blueprint");

  const tabClass = (active: boolean) =>
    `rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
      active
        ? "border-b-2 border-ds-success bg-ds-primary text-ds-foreground"
        : "border-b-2 border-transparent text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
    }`;

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-6">
      <PageHeader
        icon={LayoutGrid}
        title="Zones & Floor Plans"
        description="Map physical areas to digital context for routing, proximity, and compliance."
      />
      <nav
        className="inline-flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1"
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
      <motion.div
        key={pathname}
        className="flex min-h-0 flex-1 flex-col"
        initial={isBlueprint ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.med, ease: bpEase }}
      >
        {children}
      </motion.div>
    </div>
  );
}
