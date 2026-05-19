"use client";

import { useCallback, useState } from "react";
import {
  projectSegmentsPackedRows,
  shouldShowBarLabel,
  truncateBarLabel,
  type ProjectBarItem,
  type ProjectWeekSegment,
} from "@/lib/schedule/project-schedule-bars";
import { impactBorderAccent, projectBarPresentation } from "@/lib/schedule/project-overlay-styles";
import { cn } from "@/lib/cn";

type Props = {
  weekDates: string[];
  projects: ProjectBarItem[] | null | undefined;
  visible?: boolean;
  className?: string;
};

function ProjectBarTooltip({ seg, x, y }: { seg: ProjectWeekSegment; x: number; y: number }) {
  const impact = seg.operational_impact_level ?? "medium";
  const priority = seg.staffing_priority ?? "normal";
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[200] max-w-xs rounded-lg border border-pulseShell-border bg-white px-3 py-2 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900"
      style={{ left: x, top: y }}
    >
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{seg.name}</p>
      <p className="mt-1 text-xs text-pulse-muted">
        {seg.start_date} → {seg.end_date}
      </p>
      <dl className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
        <div className="flex justify-between gap-3">
          <dt className="text-pulse-muted">Status</dt>
          <dd className="font-medium capitalize">{seg.status.replace(/_/g, " ")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-pulse-muted">Operational impact</dt>
          <dd className="font-medium capitalize">{impact}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-pulse-muted">Staffing priority</dt>
          <dd className="font-medium capitalize">{priority}</dd>
        </div>
        {seg.assigned_team_label ? (
          <div className="flex justify-between gap-3">
            <dt className="text-pulse-muted">Team</dt>
            <dd className="font-medium">{seg.assigned_team_label}</dd>
          </div>
        ) : null}
        {(seg.pending_pto_count ?? 0) > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-pulse-muted">Pending PTO</dt>
            <dd className="font-medium">{seg.pending_pto_count}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function ScheduleProjectBarRow({ weekDates, projects, visible = true, className = "" }: Props) {
  const rows = projectSegmentsPackedRows(weekDates, projects);
  const [hover, setHover] = useState<{ seg: ProjectWeekSegment; x: number; y: number } | null>(null);

  const onEnter = useCallback((seg: ProjectWeekSegment, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setHover({ seg, x: Math.min(r.left, window.innerWidth - 300), y: r.bottom + 6 });
  }, []);

  if (!visible || rows.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          "w-full border-b border-pulseShell-border bg-pulseShell-grid/40 px-0.5 py-1 transition-[max-height,opacity] duration-200 ease-out dark:bg-pulseShell-elevated/20",
          className,
        )}
      >
        {rows.map((row, ri) => (
          <div
            // eslint-disable-next-line react/no-array-index-key -- lane order is stable
            key={`pr-${ri}`}
            className="grid min-h-[1.375rem] w-full grid-cols-7 gap-px py-px"
          >
            {row.map((s) => {
              const pres = projectBarPresentation(s);
              const showLabel = shouldShowBarLabel(s);
              return (
                <div
                  key={`${s.id}-${s.minI}-${s.maxI}`}
                  className={cn(
                    "group/bar relative flex min-h-[1.25rem] items-center justify-center self-end px-1",
                    pres.className,
                    impactBorderAccent(s.operational_impact_level),
                  )}
                  style={{ gridColumn: `${s.minI + 1} / ${s.maxI + 2}`, ...pres.style }}
                  onMouseEnter={(e) => onEnter(s, e.currentTarget)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={(e) => onEnter(s, e.currentTarget)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${s.name}, ${s.start_date} to ${s.end_date}`}
                >
                  {showLabel ? (
                    <span className="pointer-events-none truncate text-[10px] font-semibold leading-none text-gray-800/90 dark:text-gray-100/95">
                      {truncateBarLabel(s.name)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {hover ? <ProjectBarTooltip seg={hover.seg} x={hover.x} y={hover.y} /> : null}
    </>
  );
}
