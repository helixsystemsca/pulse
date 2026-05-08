"use client";

import type { TrainingTier } from "@/lib/training/types";
import { cn } from "@/lib/cn";

const tierClass: Record<TrainingTier, string> = {
  mandatory:
    "border-[color-mix(in_srgb,var(--ds-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-danger)_12%,transparent)] text-[color-mix(in_srgb,var(--ds-danger)_95%,#450a0a)] dark:text-red-100",
  high_risk:
    "border-[color-mix(in_srgb,var(--ds-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--ds-warning)_14%,transparent)] text-amber-950 dark:text-amber-100",
  general:
    "border-ds-border bg-ds-secondary/80 text-ds-muted dark:bg-ds-secondary/50",
};

const tierLabel: Record<TrainingTier, string> = {
  mandatory: "Mandatory",
  high_risk: "High risk",
  general: "General",
};

export function TrainingTierBadge({ tier, className }: { tier: TrainingTier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        tierClass[tier],
        className,
      )}
    >
      {tierLabel[tier]}
    </span>
  );
}
