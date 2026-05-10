"use client";

import { AlertTriangle } from "lucide-react";
import type { ScheduleAlerts } from "@/lib/schedule/types";

export function ScheduleAlertsBanner({ alerts }: { alerts: ScheduleAlerts }) {
  const parts: string[] = [];
  if (alerts.roP4BandGapCount > 0) {
    parts.push(
      `${alerts.roP4BandGapCount} staffed band${alerts.roP4BandGapCount === 1 ? "" : "s"} (day / afternoon / night) missing RO or P4`,
    );
  }
  if (alerts.unassignedShiftCount > 0) {
    parts.push(
      `${alerts.unassignedShiftCount} open shift${alerts.unassignedShiftCount === 1 ? "" : "s"} unassigned`,
    );
  }
  if (alerts.coverageCritical > 0) {
    parts.push(
      `${alerts.coverageCritical} critical coverage rule violation${alerts.coverageCritical === 1 ? "" : "s"}`,
    );
  }
  if (alerts.coverageWarnings > 0) {
    parts.push(
      `${alerts.coverageWarnings} coverage warning${alerts.coverageWarnings === 1 ? "" : "s"}`,
    );
  }

  if (parts.length === 0) {
    return (
      <div className="rounded-md border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-950 shadow-sm dark:border-emerald-500/25 dark:bg-emerald-950/30 dark:text-emerald-100">
        <span className="font-medium">Schedule health:</span> staffed day / afternoon / night bands include RO or P4 where
        applicable; no other staffing warnings for this month.
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-start gap-2 rounded-md border border-amber-200/90 bg-amber-50/60 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100"
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" strokeWidth={2} aria-hidden />
      <p>
        <span className="font-semibold">Staffing warnings: </span>
        {parts.join(" · ")}
      </p>
    </div>
  );
}
