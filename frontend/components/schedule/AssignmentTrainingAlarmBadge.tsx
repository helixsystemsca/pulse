"use client";

import { AlertTriangle } from "lucide-react";
import { assignmentAlarmSummary, type AssignmentAlarm } from "@/lib/schedule/assignment-eligibility";

type Props = {
  alarms: AssignmentAlarm[];
  size?: "compact" | "day";
};

/** Unmissable training/competency alarm on a shift assignment chip. */
export function AssignmentTrainingAlarmBadge({ alarms, size = "compact" }: Props) {
  if (!alarms.length) return null;
  const tip = assignmentAlarmSummary(alarms);
  const compact = size === "compact";
  return (
    <span
      role="img"
      aria-label={tip}
      title={tip}
      className={
        compact
          ? "inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-amber-500 px-0.5 text-[8px] font-black uppercase leading-none text-white ring-1 ring-amber-700/40"
          : "inline-flex items-center gap-0.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
      }
    >
      <AlertTriangle className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
      {compact ? "!" : "Training"}
    </span>
  );
}
