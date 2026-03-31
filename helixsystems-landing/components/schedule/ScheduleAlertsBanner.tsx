"use client";

import { AlertTriangle } from "lucide-react";
import type { ScheduleAlerts } from "@/lib/schedule/types";

export function ScheduleAlertsBanner({ alerts }: { alerts: ScheduleAlerts }) {
  const parts: string[] = [];
  if (alerts.daysMissingSupervisor > 0) {
    parts.push(
      `${alerts.daysMissingSupervisor} day${alerts.daysMissingSupervisor === 1 ? "" : "s"} missing supervisor coverage`,
    );
  }
  if (alerts.unassignedShiftCount > 0) {
    parts.push(
      `${alerts.unassignedShiftCount} open shift${alerts.unassignedShiftCount === 1 ? "" : "s"} unassigned`,
    );
  }
  if (alerts.openSupervisorSlots > 0) {
    parts.push(
      `${alerts.openSupervisorSlots} supervisor slot${alerts.openSupervisorSlots === 1 ? "" : "s"} need assignment`,
    );
  }

  if (parts.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-950 shadow-sm">
        <span className="font-medium">Schedule health:</span> no staffing warnings for this month.
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-start gap-2 rounded-xl border border-amber-200/90 bg-amber-50/60 px-4 py-3 text-sm text-amber-950 shadow-sm"
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" strokeWidth={2} aria-hidden />
      <p>
        <span className="font-semibold">Staffing warnings: </span>
        {parts.join(" · ")}
      </p>
    </div>
  );
}
