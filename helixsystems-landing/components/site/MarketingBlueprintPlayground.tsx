"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { bpDuration, bpEase } from "@/lib/motion-presets";

const BlueprintDesigner = dynamic(
  () =>
    import("@/components/zones-devices/BlueprintDesigner").then((m) => ({
      default: m.BlueprintDesigner,
    })),
  {
    ssr: false,
    loading: () => (
      <motion.div
        className="bp-shell bp-shell--loading"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: bpDuration.med, ease: bpEase }}
      >
        <p className="bp-muted">Loading blueprint playground…</p>
      </motion.div>
    ),
  },
);

/** Marketing-route editor: no tenant persistence; full UI + export (see `standalone` on `BlueprintDesigner`). */
export function MarketingBlueprintPlayground() {
  return <BlueprintDesigner standalone />;
}
