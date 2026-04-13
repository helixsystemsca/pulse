"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FloorPlanBlueprintSection } from "@/components/zones-devices/FloorPlanBlueprintSection";
import { bpEase, bpDuration } from "@/lib/motion-presets";

export default function ZonesDevicesZonesPage() {
  return (
    <div className="space-y-6">
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
