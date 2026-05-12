"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { motionTransition } from "@/lib/motion";

/**
 * Primary surface for authenticated feature pages: one card over {@link PulseThemedBackground}.
 */
export function PageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={`app-page-shell flex min-h-0 w-full flex-1 flex-col ${className}`.trim()}
      // Avoid transforms on the page container so `position: fixed` modals/drawers
      // are not re-anchored to this element (which can cause header overlap/clipping).
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={motionTransition.medium}
    >
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children}</div>
    </motion.div>
  );
}
