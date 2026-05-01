"use client";

import { useMemo } from "react";
import type { TaskRow } from "@/lib/projectsService";
import { parseLocalDate } from "@/lib/schedule/calendar";

const MS_PER_DAY = 86_400_000;
const DAY_WIDTH_PX = 24;
const MIN_BAR_PX = 8;

export type GanttNormalizedTask = TaskRow & {
  _start: Date;
  _end: Date;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseTaskStart(task: TaskRow): Date | null {
  if (task.planned_start_at?.trim()) {
    const d = new Date(task.planned_start_at);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (task.start_date?.trim()) {
    try {
      return parseLocalDate(task.start_date.trim());
    } catch {
      const d = new Date(`${task.start_date.trim()}T12:00:00`);
      return Number.isFinite(d.getTime()) ? d : null;
    }
  }
  return null;
}

/** Prefer explicit API field; else parse `estimated_duration` string; else derive days from minutes. */
function durationEstimateDays(task: TaskRow): number | undefined {
  if (typeof task.duration_estimate === "number" && Number.isFinite(task.duration_estimate) && task.duration_estimate > 0) {
    return Math.floor(task.duration_estimate);
  }
  const raw = task.estimated_duration?.trim();
  if (raw) {
    const m = raw.match(/(\d+)/);
    if (m) {
      const v = Number.parseInt(m[1], 10);
      if (Number.isFinite(v) && v > 0) return v;
    }
  }
  if (task.estimated_completion_minutes != null && task.estimated_completion_minutes > 0) {
    return Math.max(1, Math.ceil(task.estimated_completion_minutes / (24 * 60)));
  }
  return undefined;
}

/** Derive `_start` / `_end` so bars always have a positive span when start exists. */
export function normalizeTasks(tasks: TaskRow[]): GanttNormalizedTask[] {
  return tasks.map((task) => {
    const start = parseTaskStart(task);
    const anchor = start ?? new Date(NaN);

    let end: Date;

    if (task.planned_end_at?.trim()) {
      end = new Date(task.planned_end_at);
      if (!Number.isFinite(end.getTime())) {
        end = new Date(anchor);
        end.setDate(end.getDate() + 1);
      }
    } else if (task.end_date?.trim()) {
      try {
        end = parseLocalDate(task.end_date.trim());
      } catch {
        end = new Date(`${task.end_date.trim()}T12:00:00`);
      }
      if (!Number.isFinite(end.getTime())) {
        end = new Date(anchor);
        end.setDate(end.getDate() + 1);
      }
    } else {
      const days = durationEstimateDays(task);
      if (days != null && start) {
        end = new Date(start);
        end.setDate(end.getDate() + days);
      } else if (start) {
        end = new Date(start);
        end.setDate(end.getDate() + 1);
      } else {
        end = new Date(anchor);
      }
    }

    if (start && end.getTime() <= start.getTime()) {
      end = new Date(start);
      end.setDate(end.getDate() + 1);
    }

    return {
      ...task,
      _start: start ?? anchor,
      _end: end,
    };
  });
}

function normLabel(s: string | null | undefined): string {
  return (s || "").trim();
}

type Props = {
  tasks: TaskRow[];
  onTaskClick?: (task: TaskRow) => void;
};

export function GanttSchedule({ tasks, onTaskClick }: Props) {
  const normalized = useMemo(() => normalizeTasks(tasks), [tasks]);

  const { minDate, maxDate } = useMemo(() => {
    const candidates: Date[] = [];
    for (const t of normalized) {
      const s = parseTaskStart(t);
      if (!s) continue;
      candidates.push(startOfLocalDay(t._start), startOfLocalDay(t._end));
    }
    if (candidates.length === 0) {
      const now = startOfLocalDay(new Date());
      return { minDate: now, maxDate: new Date(now.getTime() + MS_PER_DAY) };
    }
    let minT = Math.min(...candidates.map((d) => d.getTime()));
    let maxT = Math.max(...candidates.map((d) => d.getTime()));
    if (maxT <= minT) maxT = minT + MS_PER_DAY;
    return {
      minDate: new Date(minT),
      maxDate: new Date(maxT),
    };
  }, [normalized]);

  const origin = startOfLocalDay(minDate);
  const spanDays = Math.max(1, Math.ceil((startOfLocalDay(maxDate).getTime() - origin.getTime()) / MS_PER_DAY));
  const timelineWidthPx = spanDays * DAY_WIDTH_PX;

  const groups = useMemo(() => {
    const g = new Map<string, GanttNormalizedTask[]>();
    for (const t of normalized) {
      const key = normLabel(t.phase_group) || "Tasks";
      g.set(key, [...(g.get(key) || []), t]);
    }
    return [...g.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [normalized]);

  const barLayout = (t: GanttNormalizedTask) => {
    const s0 = startOfLocalDay(t._start);
    const e0 = startOfLocalDay(t._end);
    const leftDays = (s0.getTime() - origin.getTime()) / MS_PER_DAY;
    const widthDays = Math.max(0, (e0.getTime() - s0.getTime()) / MS_PER_DAY);
    let leftPx = leftDays * DAY_WIDTH_PX;
    let widthPx = widthDays * DAY_WIDTH_PX;
    if (!Number.isFinite(leftPx)) leftPx = 0;
    if (!Number.isFinite(widthPx) || widthPx <= 0) widthPx = MIN_BAR_PX;
    widthPx = Math.max(MIN_BAR_PX, widthPx);
    return { leftPx, widthPx };
  };

  if (tasks.length === 0) {
    return <p className="text-sm text-ds-muted">No tasks yet.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-ds-border bg-ds-secondary px-3 py-2 text-[11px] font-semibold text-ds-muted">
        Range: {minDate.toLocaleDateString()} → {maxDate.toLocaleDateString()}
      </div>

      {groups.map(([g, rows]) => {
        const sorted = rows.slice().sort((a, b) => {
          const sa = parseTaskStart(a)?.getTime() ?? Number.POSITIVE_INFINITY;
          const sb = parseTaskStart(b)?.getTime() ?? Number.POSITIVE_INFINITY;
          return sa - sb;
        });
        return (
          <div key={g} className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">{g}</p>
            <div className="space-y-2">
              {sorted.map((t) => {
                const hasStart = Boolean(parseTaskStart(t));
                const { leftPx, widthPx } = hasStart ? barLayout(t) : { leftPx: 0, widthPx: MIN_BAR_PX };
                const label = hasStart ? startOfLocalDay(t._start).toLocaleDateString() : "—";
                const label2 = hasStart ? startOfLocalDay(t._end).toLocaleDateString() : "—";
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                    <button
                      type="button"
                      className="w-full max-w-[min(100%,14rem)] shrink-0 truncate text-left text-sm font-semibold text-ds-foreground hover:underline sm:w-52"
                      onClick={() => onTaskClick?.(t)}
                    >
                      {t.title}
                    </button>
                    <div className="min-w-0 flex-1 overflow-x-auto">
                      <div
                        className="relative h-8 rounded-md border border-ds-border bg-white dark:bg-ds-primary"
                        style={{
                          width: timelineWidthPx,
                          minWidth: "100%",
                          backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent ${DAY_WIDTH_PX - 1}px, color-mix(in srgb, var(--ds-border) 55%, transparent) ${DAY_WIDTH_PX - 1}px, color-mix(in srgb, var(--ds-border) 55%, transparent) ${DAY_WIDTH_PX}px)`,
                        }}
                      >
                        {hasStart ? (
                          <div
                            className="absolute top-1/2 z-[1] h-3 max-w-full -translate-y-1/2 rounded-full bg-ds-success/75 shadow-sm"
                            style={{ left: leftPx, width: widthPx }}
                            title={`${label} → ${label2}`}
                          />
                        ) : (
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] text-ds-muted">Set a start date to show this task on the timeline.</span>
                        )}
                        {hasStart ? (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2 text-[10px] font-semibold text-ds-muted">
                            <span>{label}</span>
                            <span>{label2}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
