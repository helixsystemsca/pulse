"use client";

import type { TrainingAssignmentStatus } from "@/lib/training/types";
import { cn } from "@/lib/cn";

const LABEL: Record<TrainingAssignmentStatus, string> = {
  completed: "Verified complete",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  pending: "Not started",
  revision_pending: "Revision pending",
  not_assigned: "Not assigned",
  in_progress: "Reviewing",
  acknowledged: "Acknowledged — quiz pending",
  quiz_failed: "Knowledge check — retry",
  not_applicable: "Not applicable",
};

const STYLE: Record<TrainingAssignmentStatus, string> = {
  completed: "border-ds-border bg-[color-mix(in_srgb,var(--ds-success)_14%,transparent)] text-ds-foreground",
  expiring_soon:
    "border-[color-mix(in_srgb,var(--ds-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--ds-warning)_12%,transparent)] text-ds-foreground",
  expired: "border-ds-danger/35 bg-[color-mix(in_srgb,var(--ds-danger)_12%,transparent)] text-ds-danger",
  pending: "border-zinc-400/35 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-100",
  revision_pending:
    "border-[color-mix(in_srgb,var(--ds-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--ds-accent)_10%,transparent)] text-ds-foreground",
  not_assigned: "border-dashed border-ds-border bg-transparent text-ds-muted",
  in_progress: "border-sky-500/35 bg-sky-100 text-sky-950 dark:bg-sky-950/45 dark:text-sky-50",
  acknowledged: "border-yellow-500/35 bg-yellow-100 text-yellow-950 dark:bg-yellow-950/40 dark:text-yellow-50",
  quiz_failed: "border-ds-danger/40 bg-[color-mix(in_srgb,var(--ds-danger)_12%,transparent)] text-ds-danger",
  not_applicable: "border-slate-500/40 bg-slate-200/80 text-slate-800 dark:border-slate-500 dark:bg-slate-700/80 dark:text-slate-100",
};

export function TrainingStatusBadge({
  status,
  className,
}: {
  status: TrainingAssignmentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums",
        STYLE[status],
        className,
      )}
      title={LABEL[status]}
    >
      {LABEL[status]}
    </span>
  );
}
