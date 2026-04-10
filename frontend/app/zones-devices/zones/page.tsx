"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FloorPlanBlueprintSection } from "@/components/zones-devices/FloorPlanBlueprintSection";
import { ModuleOnboardingHint } from "@/components/onboarding/ModuleOnboardingHint";
import { isApiMode } from "@/lib/api";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { fetchSetupProgress } from "@/lib/onboardingService";
import { canAccessPulseTenantApis } from "@/lib/pulse-session";
import { bpEase, bpDuration } from "@/lib/motion-presets";

export default function ZonesDevicesZonesPage() {
  const { session } = usePulseAuth();
  const [showEmptyHint, setShowEmptyHint] = useState(false);

  useEffect(() => {
    if (!isApiMode() || !session?.access_token || !canAccessPulseTenantApis(session)) {
      setShowEmptyHint(false);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const p = await fetchSetupProgress();
        if (!cancel) setShowEmptyHint(p.zone_count === 0 && p.blueprint_count === 0);
      } catch {
        if (!cancel) setShowEmptyHint(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [session?.sub, session?.company_id]);

  return (
    <div className="space-y-6">
      {showEmptyHint ? (
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
      <motion.p
        className="text-sm text-ds-muted"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.med, ease: bpEase }}
      >
        Switch to the <strong className="font-semibold text-ds-foreground">Blueprint designer</strong> tab to draw
        facility layouts and place devices.
      </motion.p>
      <motion.div
        className="rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.slow, ease: bpEase, delay: 0.04 }}
      >
        <p className="m-0 text-sm text-ds-foreground">
          Zone geometry and RTLS setup continue in{" "}
          <Link href="/devices" className="ds-link font-semibold">
            Zones &amp; devices
          </Link>{" "}
          under <strong className="font-semibold">Setup</strong>. Blueprints sync to the server when you are signed in
          with a company account (API mode).
        </p>
      </motion.div>
      <motion.div
        className="mt-0"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.slow, ease: bpEase, delay: 0.06 }}
      >
        <FloorPlanBlueprintSection />
      </motion.div>
    </div>
  );
}
