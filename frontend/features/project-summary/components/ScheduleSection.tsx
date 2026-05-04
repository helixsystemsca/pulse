import { Card } from "@/components/pulse/Card";
import type { SummarySchedule } from "../types";

const ROW = "flex flex-wrap justify-between gap-2 border-b border-ds-border py-2.5 text-sm last:border-0";
const LABEL = "font-medium text-ds-muted";
const VALUE = "font-semibold tabular-nums text-ds-foreground";

function formatVariance(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "0 d (on plan)";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v} d`;
}

export function ScheduleSection({ schedule }: { schedule: SummarySchedule }) {
  return (
    <Card padding="md" variant="secondary" className="h-full">
      <h2 className="text-sm font-bold text-ds-foreground">Schedule</h2>
      <p className="mt-0.5 text-xs text-ds-muted">Duration and variance from plan.</p>
      <dl className="mt-4 divide-y divide-ds-border rounded-lg border border-ds-border bg-ds-primary px-3 dark:bg-ds-elevated">
        <div className={ROW}>
          <dt className={LABEL}>Planned duration</dt>
          <dd className={VALUE}>{schedule.planned_duration_days} d</dd>
        </div>
        <div className={ROW}>
          <dt className={LABEL}>Actual duration</dt>
          <dd className={VALUE}>{schedule.actual_duration_days != null ? `${schedule.actual_duration_days} d` : "—"}</dd>
        </div>
        <div className={ROW}>
          <dt className={LABEL}>Variance</dt>
          <dd className={VALUE}>{formatVariance(schedule.variance_days)}</dd>
        </div>
        <div className={ROW}>
          <dt className={LABEL}>Delayed tasks</dt>
          <dd className={VALUE}>{schedule.delayed_tasks}</dd>
        </div>
      </dl>
    </Card>
  );
}
