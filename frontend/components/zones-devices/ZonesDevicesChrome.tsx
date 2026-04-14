"use client";

import { motion } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ModuleOnboardingHint } from "@/components/onboarding/ModuleOnboardingHint";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
import { fetchSetupProgress } from "@/lib/onboardingService";
import { bpEase, bpDuration } from "@/lib/motion-presets";
import { canAccessPulseTenantApis } from "@/lib/pulse-session";

export function ZonesDevicesChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = usePulseAuth();
  const isZones = pathname.startsWith("/zones-devices/zones") || pathname === "/zones-devices";
  const isBlueprint = pathname.startsWith("/zones-devices/blueprint");
  const [showZonesEmptyHint, setShowZonesEmptyHint] = useState(false);

  useEffect(() => {
    if (!isZones) {
      setShowZonesEmptyHint(false);
      return;
    }
    if (!isApiMode() || !session?.access_token || !canAccessPulseTenantApis(session)) {
      setShowZonesEmptyHint(false);
      return;
    }
    let cancel = false;
    void (async () => {
      try {
        const p = await fetchSetupProgress();
        if (!cancel) setShowZonesEmptyHint(p.zone_count === 0 && p.blueprint_count === 0);
      } catch {
        if (!cancel) setShowZonesEmptyHint(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [isZones, session?.sub, session?.company_id, session?.access_token]);

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
      {isZones && showZonesEmptyHint ? (
        <motion.div
          className="mb-0"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: bpDuration.med, ease: bpEase }}
        >
          <ModuleOnboardingHint className="border-ds-border bg-ds-secondary text-ds-muted dark:border-ds-border dark:bg-ds-secondary dark:text-ds-muted">
            <strong className="font-semibold text-ds-foreground">Zones and floor plans.</strong> Use the{" "}
            <Link href="/zones-devices/blueprint" className="ds-link font-semibold">
              Blueprint designer
            </Link>{" "}
            to draw your layout, or define areas manually under{" "}
            <Link href="/zones" className="ds-link font-semibold">
              Zones
            </Link>
            .
          </ModuleOnboardingHint>
        </motion.div>
      ) : null}
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
      {/*
        Blueprint designer uses `position: fixed` for immersive fullscreen. A Framer Motion parent
        with `transform` (e.g. translateY) creates a containing block so fixed overlays only cover
        this column and the app header stays visible — use a plain div on the blueprint route.
      */}
      {isBlueprint ? (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      ) : (
        <motion.div
          key={pathname}
          className="flex min-h-0 flex-1 flex-col"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: bpDuration.med, ease: bpEase }}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}
