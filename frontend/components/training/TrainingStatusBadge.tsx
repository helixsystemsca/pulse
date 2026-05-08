"use client";

import type { TrainingAssignmentStatus } from "@/lib/training/types";
import { cn } from "@/lib/cn";

const LABEL: Record<TrainingAssignmentStatus, string> = {
  completed: "Completed",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  pending: "Pending",
  revision_pending: "Revision pending",
  not_assigned: "Not assigned",
};

const STYLE: Record<TrainingAssignmentStatus, string> = {
  completed: "border-ds-border bg-[color-mix(in_srgb,var(--ds-success)_14%,transparent)] text-ds-foreground",
  expiring_soon:
    "border-[color-mix(in_srgb,var(--ds-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--ds-warning)_12%,transparent)] text-ds-foreground",
  expired: "border-ds-danger/35 bg-[color-mix(in_srgb,var(--ds-danger)_12%,transparent)] text-ds-danger",
  pending: "border-[color-mix(in_srgb,var(--ds-info)_35%,transparent)] bg-ds-secondary text-ds-foreground",
  revision_pending:
    "border-[color-mix(in_srgb,var(--ds-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--ds-accent)_10%,transparent)] text-ds-foreground",
  not_assigned: "border-dashed border-ds-border bg-transparent text-ds-muted",
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
        "inline-flex max-w-full truncate rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        STYLE[status],
        className,
      )}
      title={LABEL[status]}
    >
      {LABEL[status]}
    </span>
  );
}
