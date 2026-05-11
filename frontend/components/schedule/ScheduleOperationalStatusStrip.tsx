"use client";

import type { ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  RefreshCw,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { ScheduleAlerts } from "@/lib/schedule/types";
import type { SchedulePeriodHeaderState } from "./ScheduleBuilderHeader";

function StatCell({
  icon: Icon,
  iconClassName,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: string;
  sub: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 basis-[8.5rem] flex-col gap-1 px-3 py-2 sm:px-4">
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClassName)} strokeWidth={2} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ds-muted">{label}</p>
          <p className="mt-0.5 truncate text-sm font-semibold leading-snug text-ds-foreground">{value}</p>
          <div className="mt-0.5 text-[11px] leading-snug text-ds-muted [&_button]:text-[var(--ds-accent)] [&_button]:hover:underline">
            {sub}
          </div>
        </div>
      </div>
    </div>
  );
}

function scheduleHealthDetail(alerts: ScheduleAlerts): string | null {
  const parts: string[] = [];
  if (alerts.roP4BandGapCount > 0) {
    parts.push(
      `${alerts.roP4BandGapCount} band gap${alerts.roP4BandGapCount === 1 ? "" : "s"} (day · afternoon · night)`,
    );
  }
  if (alerts.unassignedShiftCount > 0) {
    parts.push(`${alerts.unassignedShiftCount} open shift${alerts.unassignedShiftCount === 1 ? "" : "s"}`);
  }
  if (alerts.coverageCritical > 0) {
    parts.push(`${alerts.coverageCritical} critical`);
  }
  if (alerts.coverageWarnings > 0) {
    parts.push(`${alerts.coverageWarnings} coverage warning${alerts.coverageWarnings === 1 ? "" : "s"}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function daysInclusive(startIso: string, endIso: string): number {
  try {
    const a = new Date(`${startIso}T12:00:00`).getTime();
    const b = new Date(`${endIso}T12:00:00`).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  } catch {
    return 0;
  }
}

export type ScheduleOperationalStatusStripProps = {
  period: SchedulePeriodHeaderState;
  /** When no server period, label for the visible calendar window (e.g. "May 2026"). */
  viewPeriodLabel: string;
  viewPeriodSub: string;
  alerts: ScheduleAlerts;
  pendingAvailability: number;
  unpublishedChanges: boolean;
  trainingConflicts?: number;
  onManagePeriod?: () => void;
  onAvailabilityClick?: () => void;
};

export function ScheduleOperationalStatusStrip({
  period,
  viewPeriodLabel,
  viewPeriodSub,
  alerts,
  pendingAvailability,
  unpublishedChanges,
  trainingConflicts = 0,
  onManagePeriod,
  onAvailabilityClick,
}: ScheduleOperationalStatusStripProps) {
  const hasRoP4Gaps = alerts.roP4BandGapCount > 0;
  const coverageStress =
    hasRoP4Gaps || alerts.unassignedShiftCount > 0 || alerts.coverageCritical > 0 || alerts.coverageWarnings > 0;

  const gapParts: string[] = [];
  if (alerts.roP4BandGapCount > 0) {
    gapParts.push(`${alerts.roP4BandGapCount} RO/P4 gap${alerts.roP4BandGapCount === 1 ? "" : "s"}`);
  }
  if (alerts.unassignedShiftCount > 0) {
    gapParts.push(`${alerts.unassignedShiftCount} open`);
  }
  if (alerts.coverageCritical > 0) {
    gapParts.push(`${alerts.coverageCritical} critical`);
  }
  const coveragePrimary =
    gapParts.length > 0 ? gapParts.join(" · ") : hasRoP4Gaps ? "Review band coverage" : "RO/P4 band coverage OK";

  const healthExtra = scheduleHealthDetail(alerts);
  const coverageSub = (
    <span>
      {alerts.unassignedShiftCount > 0 ? (
        <span>
          Open shifts · {alerts.unassignedShiftCount}
          {healthExtra ? <span className="text-ds-muted"> · {healthExtra}</span> : null}
        </span>
      ) : healthExtra ? (
        <span className="text-amber-800/90 dark:text-amber-200/90">{healthExtra}</span>
      ) : (
        "All staffed bands covered"
      )}
    </span>
  );

  let periodLabel = viewPeriodLabel;
  let periodSub: ReactNode = viewPeriodSub;
  if (period.kind === "active") {
    periodLabel = period.rangeLabel;
    const parsedDays =
      period.rangeLabel && period.rangeLabel.includes("–")
        ? (() => {
            const [a, b] = period.rangeLabel.split("–").map((s) => s.trim());
            if (a && b && /^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b)) {
              return daysInclusive(a, b);
            }
            return 0;
          })()
        : 0;
    periodSub = (
      <span>
        {parsedDays > 0 ? `${parsedDays} days` : null}
        {parsedDays > 0 ? " · " : null}
        <span className={period.status === "open" ? "text-emerald-700 dark:text-emerald-300" : ""}>
          {period.status === "open" ? "Availability open" : "Period draft"}
        </span>
        {period.deadlineLabel ? <span>{period.deadlineLabel}</span> : null}
        {onManagePeriod ? (
          <>
            {" · "}
            <button
              type="button"
              onClick={onManagePeriod}
              className="font-medium text-[var(--ds-accent)] hover:underline"
            >
              Manage period
            </button>
          </>
        ) : null}
      </span>
    );
  } else if (period.kind === "empty" && period.allowCreate !== false) {
    periodLabel = "No active period";
    periodSub = onManagePeriod ? (
      <button type="button" onClick={onManagePeriod} className="font-medium text-[var(--ds-accent)] hover:underline">
        Create scheduling period
      </button>
    ) : (
      "Create a period to collect availability"
    );
  }

  return (
    <div
      role="region"
      aria-label="Operational status"
      className="flex flex-col divide-y divide-pulseShell-border/70 dark:divide-slate-700/80 sm:flex-row sm:divide-x sm:divide-y-0"
    >
      <StatCell
        icon={CalendarDays}
        iconClassName="text-sky-600 dark:text-sky-400"
        label="Scheduling period"
        value={periodLabel}
        sub={periodSub}
      />
      <StatCell
        icon={CheckCircle2}
        iconClassName={coverageStress ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}
        label="Coverage"
        value={coveragePrimary}
        sub={coverageSub}
      />
      <StatCell
        icon={Clock}
        iconClassName="text-sky-600 dark:text-sky-400"
        label="Availability"
        value={
          pendingAvailability > 0
            ? `${pendingAvailability} pending submission${pendingAvailability === 1 ? "" : "s"}`
            : "All caught up"
        }
        sub={
          pendingAvailability > 0 && onAvailabilityClick ? (
            <button
              type="button"
              onClick={onAvailabilityClick}
              className="font-medium text-[var(--ds-accent)] hover:underline"
            >
              Review & approve
            </button>
          ) : (
            "No submissions waiting"
          )
        }
      />
      <StatCell
        icon={GraduationCap}
        iconClassName="text-violet-600 dark:text-violet-400"
        label="Training"
        value={trainingConflicts > 0 ? `${trainingConflicts} conflict${trainingConflicts === 1 ? "" : "s"}` : "No conflicts"}
        sub={trainingConflicts > 0 ? "Resolve before publish" : "All clear"}
      />
      <StatCell
        icon={RefreshCw}
        iconClassName={unpublishedChanges ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}
        label="Changes"
        value={unpublishedChanges ? "Unpublished edits" : "Synced"}
        sub={unpublishedChanges ? "Save draft to persist" : "Live view"}
      />
      <StatCell
        icon={Timer}
        iconClassName="text-amber-600 dark:text-amber-400"
        label="Overtime"
        value={
          alerts.coverageWarnings > 0
            ? `${alerts.coverageWarnings} scheduling note${alerts.coverageWarnings === 1 ? "" : "s"}`
            : "No scheduling notes"
        }
        sub="Monitor weekly hours in settings"
      />
    </div>
  );
}
