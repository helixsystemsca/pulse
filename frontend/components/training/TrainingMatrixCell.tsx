"use client";

import { AlertTriangle, BookOpen, Check, ClipboardCheck, Clock, X } from "lucide-react";
import type { TrainingAssignmentStatus, TrainingTier } from "@/lib/training/types";
import { cn } from "@/lib/cn";

/** Screen reader / tooltip — full phrase */
const STATUS_LABEL: Record<TrainingAssignmentStatus, string> = {
  completed: "Completed — verified",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  pending: "Not started",
  revision_pending: "Revision pending",
  not_assigned: "Not assigned",
  in_progress: "In progress — reviewing",
  acknowledged: "Acknowledged — knowledge check pending",
  quiz_failed: "Knowledge check not passed — retry",
};

/** Green = verified complete; blue = reviewing; yellow = acknowledged / quiz pending; red = quiz failed; gray = not engaged */
function matrixClasses(status: TrainingAssignmentStatus, tier: TrainingTier): string {
  if (status === "completed") {
    return cn(
      "border-teal-500/35 bg-teal-100 text-teal-900",
      "dark:border-teal-400/25 dark:bg-teal-950/55 dark:text-teal-100",
    );
  }
  if (status === "expiring_soon") {
    return cn(
      "border-amber-500/40 bg-amber-100 text-amber-950",
      "dark:border-amber-400/35 dark:bg-amber-950/45 dark:text-amber-50",
    );
  }
  if (status === "quiz_failed") {
    return cn(
      "border-[color-mix(in_srgb,var(--ds-danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--ds-danger)_14%,transparent)] text-ds-danger",
      "dark:border-red-400/35 dark:bg-[color-mix(in_srgb,#7f1d1d_45%,#1f1516)] dark:text-red-100",
    );
  }
  if (status === "acknowledged") {
    return cn(
      "border-yellow-500/45 bg-yellow-100 text-yellow-950",
      "dark:border-yellow-400/35 dark:bg-yellow-950/40 dark:text-yellow-50",
    );
  }
  if (status === "in_progress") {
    return cn(
      "border-sky-500/40 bg-sky-100 text-sky-950",
      "dark:border-sky-400/35 dark:bg-sky-950/45 dark:text-sky-50",
    );
  }

  const notEngaged = status === "not_assigned" || status === "pending";
  if (notEngaged) {
    return cn(
      "border-zinc-300/80 bg-zinc-100 text-zinc-800",
      "dark:border-zinc-600/60 dark:bg-zinc-900/50 dark:text-zinc-100",
    );
  }

  const incomplete = status === "expired" || status === "revision_pending";
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
  if (status === "in_progress") {
    return <BookOpen className={iconClass} aria-hidden />;
  }
  if (status === "acknowledged") {
    return <ClipboardCheck className={iconClass} aria-hidden />;
  }
  if (status === "quiz_failed") {
    return <AlertTriangle className={iconClass} aria-hidden />;
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
