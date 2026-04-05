"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { bpEase, bpDuration } from "@/lib/motion-presets";

export default function ZonesDevicesZonesPage() {
  return (
    <>
      <motion.p
        style={{ color: "var(--muted)", marginBottom: "1rem", maxWidth: "40rem" }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.med, ease: bpEase }}
      >
        Map physical areas to digital context for routing, proximity, and compliance. Zone geometry and anchors
        are managed alongside maintenance plans. Open the{" "}
        <strong style={{ color: "var(--text)" }}>Blueprint designer</strong> (tab above) to draw facility layouts
        and place devices.
      </motion.p>
      <motion.div
        style={{ marginBottom: "1rem" }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.med, ease: bpEase, delay: 0.02 }}
      >
        <Link href="/zones-devices/blueprint" className="zd-blueprint-cta" prefetch={false}>
          Open Blueprint designer →
        </Link>
      </motion.div>
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: bpDuration.slow, ease: bpEase, delay: 0.04 }}
        whileHover={{
          y: -4,
          boxShadow: "0 14px 36px rgba(0, 0, 0, 0.14)",
          transition: { duration: bpDuration.med, ease: bpEase },
        }}
      >
        <p style={{ margin: 0, color: "var(--text)" }}>
          Zone editor and floorplan overlays will connect to the tenant API. For now, coordinate zone labels with{" "}
          <strong>Maintenance</strong> and asset locations in <strong>Assets</strong>.
        </p>
      </motion.div>
    </>
  );
}
