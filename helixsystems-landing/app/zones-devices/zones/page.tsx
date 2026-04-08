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
    <>
      {showEmptyHint ? (
        <motion.div
          className="mb-4"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: bpDuration.med, ease: bpEase }}
        >
          <ModuleOnboardingHint>
            <strong className="font-semibold text-pulse-navy dark:text-slate-100">Zones and floor plans.</strong> Use the{" "}
            <Link href="/zones-devices/blueprint" className="font-semibold text-pulse-accent hover:underline">
              Blueprint designer
            </Link>{" "}
            to draw your layout, or define areas manually under{" "}
            <Link href="/dashboard/setup?tab=zones" className="font-semibold text-pulse-accent hover:underline">
              Setup → Zones
            </Link>
            .
          </ModuleOnboardingHint>
        </motion.div>
      ) : null}
      <motion.p
        className="mb-4 max-w-2xl text-sm text-pulse-muted"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.med, ease: bpEase }}
      >
        Map physical areas to digital context for routing, proximity, and compliance. Open the{" "}
        <strong className="text-pulse-navy dark:text-slate-100">Blueprint designer</strong> tab to draw
        facility layouts and place devices.
      </motion.p>
      <motion.div
        className="mb-4"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.med, ease: bpEase, delay: 0.02 }}
      >
        <Link
          href="/zones-devices/blueprint"
          className="inline-flex items-center gap-1 rounded-md border border-pulse-border bg-white px-4 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm transition-colors hover:border-pulse-accent/40 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500"
          prefetch={false}
        >
          Open Blueprint designer →
        </Link>
      </motion.div>
      <motion.div
        className="rounded-md border border-pulse-border bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800/80"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.slow, ease: bpEase, delay: 0.04 }}
      >
        <p className="m-0 text-sm text-pulse-navy dark:text-slate-200">
          Zone geometry and RTLS setup continue in{" "}
          <Link href="/dashboard/setup" className="font-semibold text-pulse-accent hover:underline">
            Zones &amp; devices
          </Link>{" "}
          under <strong>Setup</strong>. Blueprints sync to the server when you are signed in with a company
          account (API mode).
        </p>
      </motion.div>
      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.slow, ease: bpEase, delay: 0.06 }}
      >
        <FloorPlanBlueprintSection />
      </motion.div>
    </>
  );
}
