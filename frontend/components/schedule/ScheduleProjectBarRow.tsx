"use client";

import { projectSegmentsPackedRows, type ProjectBarItem } from "@/lib/schedule/project-schedule-bars";

type Props = {
  weekDates: string[];
  projects: ProjectBarItem[] | null | undefined;
  /** Additional classes for the strip (borders / background). */
  className?: string;
};

/**
 * A horizontal area above a week: one or more rows of coloured bars spanning
 * the days the project is scheduled for.
 */
export function ScheduleProjectBarRow({ weekDates, projects, className = "" }: Props) {
  const rows = projectSegmentsPackedRows(weekDates, projects);
  if (rows.length === 0) return null;

  return (
    <div
      className={`w-full border-b border-pulseShell-border bg-pulseShell-grid/50 px-0.5 py-0.5 dark:bg-pulseShell-elevated/15 ${className}`}
    >
      {rows.map((row, ri) => (
        <div
          // eslint-disable-next-line react/no-array-index-key -- fixed row order
          key={`pr-${ri}`}
          className="grid min-h-1.5 w-full grid-cols-7 gap-px"
          aria-hidden
        >
          {row.map((s) => (
            <div
              key={s.id}
              title={s.name}
              className={`pointer-events-none h-1.5 self-end rounded-sm ${s.tintClass} shadow-sm`}
              style={{ gridColumn: `${s.minI + 1} / ${s.maxI + 2}` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
