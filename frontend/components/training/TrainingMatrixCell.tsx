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
  not_applicable: "Not applicable",
};

/** Solid lobster pink — “not complete” (everything except verified complete + expiring-soon warning). */
function notCompleteLobsterShell(): string {
  return cn(
    "border-rose-900/45",
    "bg-[#e85d6f] text-[#3f0d14]",
    "shadow-[inset_0_1px_0_rgb(255_255_255_/_0.28)]",
    "dark:border-rose-300/40",
    "dark:bg-[#b03645] dark:text-rose-50",
    "dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12)]",
  );
}

/** Aquamarine fill = verified complete; amber = expiring soon; lobster pink = not complete */
function matrixClasses(status: TrainingAssignmentStatus): string {
  if (status === "completed") {
    return cn(
      "border-teal-700/40 bg-[#2ec4b6] text-teal-950",
      "shadow-[inset_0_1px_0_rgb(255_255_255_/_0.35)]",
      "dark:border-teal-200/35 dark:bg-[#0f766e] dark:text-teal-50",
      "dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12)]",
    );
  }
  if (status === "expiring_soon") {
    return cn(
      "border-amber-500/40 bg-amber-100 text-amber-950",
      "dark:border-amber-400/35 dark:bg-amber-950/45 dark:text-amber-50",
    );
  }
  if (status === "not_applicable") {
    return cn(
      "border-slate-500/45 bg-slate-400/95 text-slate-950",
      "shadow-[inset_0_1px_0_rgb(255_255_255_/_0.22)]",
      "dark:border-slate-400/40 dark:bg-slate-600 dark:text-slate-50",
      "dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.1)]",
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
  if (status === "not_applicable") {
    return (
      <span className="text-[15px] font-bold leading-none tabular-nums" aria-hidden>
        —
      </span>
    );
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
        className={cn(cellClass, "m-0 p-0 text-inherit")}
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
