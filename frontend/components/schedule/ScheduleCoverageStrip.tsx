"use client";

import { AlertTriangle, ClipboardList, Clock, GraduationCap, Send, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ScheduleAlerts } from "@/lib/schedule/types";

export type CoverageStripProps = {
  alerts: ScheduleAlerts;
  pendingAvailability: number;
  unpublishedChanges: boolean;
  trainingConflicts?: number;
  onCoverageClick?: () => void;
  onAvailabilityClick?: () => void;
};

function Chip({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "slate" | "amber" | "rose" | "sky" | "violet";
  onClick?: () => void;
}) {
  const tones = {
    slate: "border-slate-200/90 bg-white/90 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800/80",
    amber: "border-amber-200/80 bg-amber-50/90 text-amber-950 hover:bg-amber-50 dark:border-amber-500/25 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-950/55",
    rose: "border-rose-200/80 bg-rose-50/90 text-rose-950 hover:bg-rose-50 dark:border-rose-500/25 dark:bg-rose-950/40 dark:text-rose-50 dark:hover:bg-rose-950/55",
    sky: "border-sky-200/80 bg-sky-50/90 text-sky-950 hover:bg-sky-50 dark:border-sky-500/25 dark:bg-sky-950/35 dark:text-sky-50 dark:hover:bg-sky-950/50",
    violet:
      "border-violet-200/80 bg-violet-50/90 text-violet-950 hover:bg-violet-50 dark:border-violet-500/25 dark:bg-violet-950/35 dark:text-violet-50 dark:hover:bg-violet-950/50",
  } as const;

  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-w-[140px] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-left shadow-sm transition-colors",
        tones[tone],
        onClick && "cursor-pointer",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </Comp>
  );
}

export function ScheduleCoverageStrip({
  alerts,
  pendingAvailability,
  unpublishedChanges,
  trainingConflicts = 0,
  onCoverageClick,
  onAvailabilityClick,
}: CoverageStripProps) {
  const hasRoP4Gaps = alerts.roP4BandGapCount > 0;
  const gapParts: string[] = [];
  if (alerts.roP4BandGapCount > 0) {
    gapParts.push(
      `${alerts.roP4BandGapCount} RO/P4 band gap${alerts.roP4BandGapCount === 1 ? "" : "s"} (day · afternoon · night)`,
    );
  }
  if (alerts.unassignedShiftCount > 0) {
    gapParts.push(`${alerts.unassignedShiftCount} open`);
  }
  if (alerts.coverageCritical > 0) {
    gapParts.push(`${alerts.coverageCritical} critical`);
  }
  const gapLabel = gapParts.length ? gapParts.join(" · ") : "RO/P4 band coverage OK";

  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        icon={AlertTriangle}
        label="Coverage"
        value={gapLabel}
        tone={hasRoP4Gaps || alerts.unassignedShiftCount > 0 || alerts.coverageCritical > 0 ? "amber" : "slate"}
        onClick={onCoverageClick}
      />
      <Chip
        icon={Send}
        label="Availability"
        value={
          pendingAvailability > 0 ? `${pendingAvailability} pending submission${pendingAvailability === 1 ? "" : "s"}` : "All caught up"
        }
        tone={pendingAvailability > 0 ? "sky" : "slate"}
        onClick={onAvailabilityClick}
      />
      <Chip
        icon={GraduationCap}
        label="Training"
        value={trainingConflicts > 0 ? `${trainingConflicts} conflict${trainingConflicts === 1 ? "" : "s"}` : "No conflicts"}
        tone={trainingConflicts > 0 ? "violet" : "slate"}
      />
      <Chip
        icon={ClipboardList}
        label="Changes"
        value={unpublishedChanges ? "Unpublished edits" : "Synced"}
        tone={unpublishedChanges ? "rose" : "slate"}
      />
      <Chip
        icon={Clock}
        label="Overtime"
        value={
          alerts.coverageWarnings > 0
            ? `${alerts.coverageWarnings} scheduling note${alerts.coverageWarnings === 1 ? "" : "s"}`
            : "Review in workforce bar"
        }
        tone="slate"
      />
    </div>
  );
}
