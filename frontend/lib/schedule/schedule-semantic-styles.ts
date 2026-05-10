/**
 * Limited semantic palettes for operational scheduling (avoid per-status rainbow).
 */

import type { OperationalBadgeGroup } from "@/lib/schedule/operational-scheduling-model";

/** Compact badge pill — border + bg + text */
export function operationalBadgeClasses(group: OperationalBadgeGroup): string {
  switch (group) {
    case "leave":
      return "border border-slate-300/90 bg-slate-100 text-slate-800 dark:border-slate-500/40 dark:bg-slate-800/60 dark:text-slate-100";
    case "training":
      return "border border-sky-300/80 bg-sky-50 text-sky-950 dark:border-sky-500/35 dark:bg-sky-950/35 dark:text-sky-50";
    case "assignment":
      return "border border-violet-300/75 bg-violet-50 text-violet-950 dark:border-violet-500/35 dark:bg-violet-950/40 dark:text-violet-50";
    case "workflow":
      return "border border-amber-300/85 bg-amber-50 text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-50";
    case "special":
    default:
      return "border border-ds-border bg-ds-secondary/70 text-ds-foreground";
  }
}

/** Dominant shift code chip — neutral operational blue */
export const ASSIGNMENT_CODE_CHIP =
  "inline-flex items-center rounded-md border border-sky-200/90 bg-sky-50 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums tracking-tight text-sky-950 dark:border-sky-500/35 dark:bg-sky-950/40 dark:text-sky-50";

/** Cell backgrounds — availability layer */
export const AVAILABILITY_CELL_AVAILABLE = "bg-[color-mix(in_srgb,var(--ds-success)_6%,var(--ds-surface-primary))]";
export const AVAILABILITY_CELL_UNAVAILABLE = "bg-slate-200/55 opacity-55 dark:bg-slate-800/50 dark:opacity-60";
export const AVAILABILITY_CELL_RESTRICTED = "bg-ds-surface-primary";
