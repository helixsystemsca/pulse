"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { bpEase, bpDuration } from "@/lib/motion-presets";

export default function ZonesDevicesZonesPage() {
  return (
    <>
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
          className="inline-flex items-center gap-1 rounded-xl border border-pulse-border bg-white px-4 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm transition-colors hover:border-pulse-accent/40 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500"
          prefetch={false}
        >
          Open Blueprint designer →
        </Link>
      </motion.div>
      <motion.div
        className="rounded-2xl border border-pulse-border bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800/80"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.slow, ease: bpEase, delay: 0.04 }}
      >
        <p className="m-0 text-sm text-pulse-navy dark:text-slate-200">
          Zone geometry and RTLS setup continue in{" "}
          <Link href="/dashboard/setup" className="font-semibold text-pulse-accent hover:underline">
            Zones &amp; devices
          </Link>{" "}
          under <strong>Setup</strong>. Blueprints stored here sync with the tenant API when the maintenance
          module is enabled.
        </p>
      </motion.div>
    </>
  );
}
