"use client";

import { motion } from "framer-motion";
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
        className="mt-0"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.slow, ease: bpEase, delay: 0.04 }}
      >
        <FloorPlanBlueprintSection />
      </motion.div>
    </div>
  );
}
