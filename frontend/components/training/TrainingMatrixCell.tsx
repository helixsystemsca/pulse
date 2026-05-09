"use client";

import { Check, Clock, X } from "lucide-react";
import type { TrainingAssignmentStatus, TrainingTier } from "@/lib/training/types";
import { cn } from "@/lib/cn";

/** Screen reader / tooltip — full phrase */
const STATUS_LABEL: Record<TrainingAssignmentStatus, string> = {
  completed: "Completed",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  pending: "Pending",
  revision_pending: "Revision pending",
  not_assigned: "Not assigned",
};

/** Teal = complete; yellow = expiring soon; lobster pink = gap on mandatory; peach = gap on non-mandatory */
function matrixClasses(status: TrainingAssignmentStatus, tier: TrainingTier): string {
  if (status === "completed") {
    return cn(
      "border-teal-500/35 bg-teal-100 text-teal-900",
      "dark:border-teal-400/25 dark:bg-teal-950/55 dark:text-teal-100",
    );
  }
  if (status === "expiring_soon") {
    return cn(
      "border-yellow-500/40 bg-yellow-100 text-yellow-950",
      "dark:border-yellow-400/35 dark:bg-yellow-950/45 dark:text-yellow-100",
    );
  }

  const incomplete =
    status === "not_assigned" || status === "expired" || status === "pending" || status === "revision_pending";
  if (incomplete) {
    if (tier === "mandatory") {
      return cn(
        "border-[color-mix(in_srgb,#c94c54_42%,transparent)] bg-[#f2aeb4] text-[#5a1a22]",
        "dark:border-[#f4a5a8]/35 dark:bg-[color-mix(in_srgb,#7f1d1d_55%,#1f1516)] dark:text-[#fecaca]",
      );
    }
    return cn(
      "border-[color-mix(in_srgb,#d4a574_45%,transparent)] bg-[#ffe8d9] text-[#5c3d26]",
      "dark:border-[#fdba74]/25 dark:bg-[color-mix(in_srgb,#9a3412_28%,#1c1410)] dark:text-[#fed7aa]",
    );
  }

  return "border-ds-border bg-ds-secondary text-ds-foreground";
}

function MatrixIcon({ status }: { status: TrainingAssignmentStatus }) {
  const iconClass = "h-4 w-4 shrink-0 stroke-[2.5]";
  if (status === "completed") {
    return <Check className={iconClass} aria-hidden />;
  }
  if (status === "expiring_soon") {
    return <Clock className={iconClass} aria-hidden />;
  }
  return <X className={iconClass} aria-hidden />;
}

export function TrainingMatrixCell({
  status,
  tier,
  className,
}: {
  status: TrainingAssignmentStatus;
  tier: TrainingTier;
  className?: string;
}) {
  const label = STATUS_LABEL[status];

  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-full min-w-[2.25rem] items-center justify-center rounded-lg border px-1.5",
        matrixClasses(status, tier),
        className,
      )}
    >
      <MatrixIcon status={status} />
    </span>
  );
}
