"use client";

import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/cn";
import type { ScheduleAlerts } from "@/lib/schedule/types";

export function ScheduleStaffingSignalsRow({ alerts }: { alerts: ScheduleAlerts }) {
  const alertCount =
    alerts.roP4BandGapCount +
    alerts.unassignedShiftCount +
    alerts.coverageCritical +
    alerts.coverageWarnings;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-pulseShell-border/80 bg-white/80 px-3 py-2.5 text-xs shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-ds-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Staffing signals · </span>
            {alertCount > 0 ? `${alertCount} open signal${alertCount === 1 ? "" : "s"}` : "No banner alerts"}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-ds-muted">
            RO/P4 band coverage, open shifts, and scheduling notes are in the strip below.
          </p>
        </div>
      </div>
    </div>
  );
}
