"use client";

import { motion } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { bpEase, bpDuration } from "@/lib/motion-presets";

export function ZonesDevicesChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isZones = pathname.startsWith("/zones-devices/zones") || pathname === "/zones-devices";
  const isBlueprint = pathname.startsWith("/zones-devices/blueprint");

  useEffect(() => {
    if (!isBlueprint) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isBlueprint]);

  const tabClass = (active: boolean) =>
    `rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
      active
        ? "border-b-2 border-ds-success bg-ds-primary text-ds-foreground"
        : "border-b-2 border-transparent text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
    }`;

  if (isBlueprint) {
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col bg-ds-bg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pulse-blueprint-fullscreen-title"
      >
        <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-ds-border bg-ds-primary px-3 shadow-[var(--ds-shadow-card)] sm:h-14 sm:px-4">
          <div className="flex justify-start">
            <Link
              href="/zones-devices/zones"
              prefetch={false}
              className="ds-btn-secondary inline-flex shrink-0 items-center justify-center px-3 py-2 text-xs font-semibold sm:text-sm"
            >
              ← Back to Zones
            </Link>
          </div>
          <h1
            id="pulse-blueprint-fullscreen-title"
            className="min-w-0 max-w-[min(100vw-11rem,24rem)] truncate text-center text-sm font-semibold text-ds-foreground sm:max-w-md sm:text-base"
          >
            Blueprint designer
          </h1>
          <div className="flex justify-end" aria-hidden />
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    );
  }

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
