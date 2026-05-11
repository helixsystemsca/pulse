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

/** Lobster pink + soft white sweep — “not complete” (everything except verified complete + expiring-soon warning). */
function notCompleteLobsterShell(): string {
  return cn(
    "border-[color-mix(in_srgb,#c94c54_38%,transparent)]",
    "bg-[linear-gradient(148deg,rgb(255_255_255_/_0.98)_0%,rgb(255_250_251_/_0.92)_42%,rgb(244_176_184_/_0.88)_100%)]",
    "text-[#5a1f27] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.65)]",
    "dark:border-[color-mix(in_srgb,#f4a5aa_32%,transparent)]",
    "dark:bg-[linear-gradient(152deg,color-mix(in_srgb,#3a1518_92%,#0f0a0a)_0%,color-mix(in_srgb,#6b2830_70%,#141010)_48%,color-mix(in_srgb,#5c2228_85%,#120d0e)_100%)]",
    "dark:text-[#fecdd3] dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06)]",
  );
}

/** Green = verified complete; amber = expiring soon (still highlighted separately); lobster = not complete */
function matrixClasses(status: TrainingAssignmentStatus): string {
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

  return notCompleteLobsterShell();
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
  tier: _tier,
  className,
  interactive,
  onClick,
  disabled,
  title: titleProp,
}: {
  status: TrainingAssignmentStatus;
  tier: TrainingTier;
  className?: string;
  /** When set with `onClick`, renders a focusable control for matrix admin overrides. */
  interactive?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const label = STATUS_LABEL[status];
  const title = titleProp ?? label;
  const cellClass = cn(
    "inline-flex h-8 w-full min-w-[2.25rem] items-center justify-center rounded-lg border px-1.5",
    matrixClasses(status),
    interactive && !disabled && "cursor-pointer hover:opacity-95 active:scale-[0.98]",
    disabled && "cursor-wait opacity-70",
    className,
  );

  if (interactive && onClick) {
    return (
      <button
        type="button"
        aria-label={label}
        title={title}
        disabled={disabled}
        onClick={onClick}
        className={cn(cellClass, "m-0 bg-transparent p-0 text-inherit")}
      >
        <MatrixIcon status={status} />
      </button>
    );
  }

  return (
    <span aria-label={label} title={title} className={cellClass}>
      <MatrixIcon status={status} />
    </span>
  );
}
