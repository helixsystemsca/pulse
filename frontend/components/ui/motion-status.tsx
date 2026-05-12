"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { cn } from "@/lib/cn";

const pulseSoft = {
  opacity: [0.55, 1, 0.55],
  scale: [1, 1.06, 1],
};

/** Online / presence dot — soft opacity pulse every ~2.5s */
export function StatusDot({
  color = "emerald",
  label,
  className,
}: {
  color?: "emerald" | "sky" | "amber" | "rose" | "slate";
  label: string;
  className?: string;
}) {
  const { reduced } = useReducedEffects();
  const ring = useMemo(() => {
    switch (color) {
      case "sky":
        return "bg-sky-500 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ds-border)_70%,transparent)]";
      case "amber":
        return "bg-amber-400 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ds-border)_70%,transparent)]";
      case "rose":
        return "bg-rose-500 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ds-border)_70%,transparent)]";
      case "slate":
        return "bg-slate-400 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ds-border)_70%,transparent)]";
      default:
        return "bg-emerald-500 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ds-border)_70%,transparent)]";
    }
  }, [color]);

  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={label}>
      <motion.span
        className={cn("relative inline-flex h-2 w-2 rounded-full", ring)}
        aria-hidden
        animate={reduced ? undefined : pulseSoft}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Live / streaming telemetry indicator */
export function LiveIndicator({ className }: { className?: string }) {
  const { reduced } = useReducedEffects();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-ds-border/80 bg-ds-secondary/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ds-muted",
        className,
      )}
    >
      <motion.span
        className="h-1.5 w-1.5 rounded-full bg-sky-500"
        aria-hidden
        animate={reduced ? undefined : { opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      Live
    </span>
  );
}

/** Smooth width transition for determinate progress (transform-only inner bar). */
export function AnimatedProgress({
  value,
  max = 100,
  className,
  trackClassName,
}: {
  value: number;
  max?: number;
  className?: string;
  trackClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, max <= 0 ? 0 : (value / max) * 100));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-ds-secondary/80 dark:bg-ds-secondary/50", trackClassName)}>
      <motion.div
        className={cn("h-full w-full origin-left rounded-full bg-[color-mix(in_srgb,var(--ds-accent)_82%,transparent)]", className)}
        initial={false}
        animate={{ scaleX: pct / 100 }}
        transition={{ type: "tween", duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/** Urgent / escalated work — soft border glow pulse */
export function EscalationBadge({ children, className }: { children: ReactNode; className?: string }) {
  const { reduced } = useReducedEffects();
  return (
    <motion.span
      className={cn(
        "inline-flex items-center rounded-md border border-rose-300/80 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-900 dark:border-rose-500/45 dark:bg-rose-950/40 dark:text-rose-100",
        className,
      )}
      animate={
        reduced
          ? undefined
          : {
              boxShadow: [
                "0 0 0 0 color-mix(in srgb, rgb(244 63 94) 0%, transparent)",
                "0 0 0 4px color-mix(in srgb, rgb(244 63 94) 22%, transparent)",
                "0 0 0 0 color-mix(in srgb, rgb(244 63 94) 0%, transparent)",
              ],
            }
      }
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.span>
  );
}
