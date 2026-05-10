"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";

import { TC_COLORS } from "./training-compliance-visual";

export type StatusMetricVariant = "completed" | "expiring" | "missing";

const VARIANT_STYLES: Record<
  StatusMetricVariant,
  {
    iconWrap: string;
    accentBorder: string;
    hoverRing: string;
    surface: string;
  }
> = {
  completed: {
    iconWrap: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
    accentBorder: "border-l-[3px] border-l-teal-500/80",
    hoverRing: "hover:ring-teal-500/25",
    surface: "bg-teal-500/[0.07] dark:bg-teal-400/[0.08]",
  },
  expiring: {
    iconWrap: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    accentBorder: "border-l-[3px] border-l-amber-500/85",
    hoverRing: "hover:ring-amber-400/25",
    surface: "bg-amber-500/[0.08] dark:bg-amber-400/[0.09]",
  },
  missing: {
    iconWrap: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    accentBorder: "border-l-[3px] border-l-rose-500/85",
    hoverRing: "hover:ring-rose-400/30",
    surface: "bg-rose-500/[0.08] dark:bg-rose-400/[0.09]",
  },
};

export type StatusMetricCardProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  subtext: string;
  count: number;
  variant: StatusMetricVariant;
  /** Stronger attention when there are compliance gaps */
  emphasize?: boolean;
  className?: string;
  /** Tighter vertical rhythm for stacked dashboard column */
  compact?: boolean;
};

export function StatusMetricCard({
  href,
  icon: Icon,
  label,
  subtext,
  count,
  variant,
  emphasize = false,
  className,
  compact = false,
}: StatusMetricCardProps) {
  const vs = VARIANT_STYLES[variant];
  const glow =
    variant === "completed" ? TC_COLORS.completed.glow : variant === "expiring" ? TC_COLORS.expiring.glow : TC_COLORS.missing.glow;

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.995 }} transition={{ type: "spring", stiffness: 520, damping: 28 }}>
      <Link
        href={href}
        className={cn(
          "group relative flex items-center rounded-xl border border-black/[0.06] shadow-sm backdrop-blur-sm transition-all duration-200 dark:border-white/[0.08]",
          compact ? "gap-2 px-2.5 py-2" : "gap-3 px-3 py-2.5",
          vs.surface,
          vs.accentBorder,
          vs.hoverRing,
          "hover:border-black/[0.1] hover:shadow-md dark:hover:border-white/[0.12]",
          emphasize && variant === "missing"
            ? "shadow-[0_8px_28px_-8px_rgba(255,77,109,0.45),0_4px_14px_-6px_rgba(15,23,42,0.12)] ring-1 ring-rose-400/35 dark:shadow-[0_8px_32px_-8px_rgba(255,90,122,0.35)]"
            : "hover:shadow-[0_10px_28px_-12px_rgba(15,23,42,0.14)]",
          className,
        )}
      >
        {emphasize && variant === "missing" ? (
          <span
            className="pointer-events-none absolute inset-0 rounded-xl opacity-70 motion-safe:animate-pulse"
            style={{
              boxShadow: `inset 0 0 0 1px ${glow}`,
            }}
            aria-hidden
          />
        ) : null}
        <span
          className={cn(
            "relative flex shrink-0 items-center justify-center rounded-lg ring-1 ring-black/[0.05] dark:ring-white/10",
            compact ? "h-8 w-8" : "h-10 w-10",
            vs.iconWrap,
          )}
        >
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold text-ds-foreground", compact ? "text-xs" : "text-sm")}>{label}</p>
          <p className={cn("font-medium text-ds-muted", compact ? "mt-px text-[10px]" : "mt-0.5 text-xs")}>{subtext}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <motion.span
            key={count}
            initial={{ opacity: 0.35, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22 }}
            className={cn(
              "font-extrabold tabular-nums tracking-tight text-ds-foreground",
              compact ? "text-base" : "text-lg",
            )}
          >
            {count.toLocaleString()}
          </motion.span>
          <span
            className="text-ds-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ds-foreground"
            aria-hidden
          >
            ›
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
