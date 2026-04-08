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
      className={`app-page-shell flex min-h-0 w-full flex-1 flex-col ${className}`.trim()}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={bpTransition.med}
    >
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children}</div>
    </motion.div>
  );
}
