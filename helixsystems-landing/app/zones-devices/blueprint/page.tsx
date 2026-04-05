"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { bpEase, bpDuration } from "@/lib/motion-presets";

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
        <p className="bp-muted">Loading blueprint editor…</p>
      </motion.div>
    ),
  },
);

export default function BlueprintPage() {
  return <BlueprintDesigner />;
}
