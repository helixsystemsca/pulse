"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { bpTransition } from "@/lib/motion-presets";

/**
 * Primary surface for authenticated feature pages: one card over {@link PulseThemedBackground}.
 */
export function PageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={`app-page-shell min-h-0 w-full ${className}`.trim()}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={bpTransition.med}
    >
      <div className="relative z-[1] min-h-0">{children}</div>
    </motion.div>
  );
}
