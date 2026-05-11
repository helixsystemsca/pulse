"use client";

import type { ScheduleAlerts } from "@/lib/schedule/types";
import { ScheduleAlertsBanner } from "./ScheduleAlertsBanner";
import { ScheduleCoverageStrip } from "./ScheduleCoverageStrip";
import { ScheduleStaffingSignalsRow } from "./ScheduleStaffingSignalsRow";

export type ScheduleOperationalSignalsBarProps = {
  alerts: ScheduleAlerts;
  pendingAvailability: number;
  unpublishedChanges: boolean;
  trainingConflicts?: number;
  onAvailabilityClick?: () => void;
};

/**
 * Full-width strip above the builder main grid: staffing signals, coverage / availability chips,
 * and schedule health copy — kept visually lightweight so the calendar stays the focal point.
 */
export function ScheduleOperationalSignalsBar({
  alerts,
  pendingAvailability,
  unpublishedChanges,
  trainingConflicts = 0,
  onAvailabilityClick,
}: ScheduleOperationalSignalsBarProps) {
  return (
    <section
      aria-label="Schedule health and operational signals"
      className="w-full shrink-0 rounded-xl border border-sky-200/70 bg-gradient-to-r from-emerald-50/90 via-sky-50/70 to-sky-50/40 px-4 py-3 shadow-sm dark:border-sky-900/45 dark:from-emerald-950/30 dark:via-slate-900/55 dark:to-slate-900/40"
    >
      <div className="flex w-full flex-col gap-3">
        <ScheduleStaffingSignalsRow alerts={alerts} />
        <ScheduleCoverageStrip
          alerts={alerts}
          pendingAvailability={pendingAvailability}
          unpublishedChanges={unpublishedChanges}
          trainingConflicts={trainingConflicts}
          onAvailabilityClick={onAvailabilityClick}
        />
        <ScheduleAlertsBanner alerts={alerts} />
      </div>
    </section>
  );
}
