"use client";

import { useMemo, type CSSProperties } from "react";
import type { TaskRow } from "@/lib/projectsService";
import { computeCPM, normalizeTaskCategory, TASK_CATEGORY_COLORS } from "@/lib/projects/cpm";
import { parseLocalDate } from "@/lib/schedule/calendar";

const MS_PER_DAY = 86_400_000;
const MS_GAP_IMPLICIT = 3_600_000; // 1h between auto-placed tasks
const DAY_WIDTH_PX = 32;
const MIN_BAR_PX = 10;
const SIDEBAR_W = "14rem";

export type GanttNormalizedTask = TaskRow & {
  _start: Date;
  _end: Date;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
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

function durationMs(task: TaskRow): number {
  if (task.estimated_completion_minutes != null && task.estimated_completion_minutes > 0) {
    return task.estimated_completion_minutes * 60 * 1000;
  }
  const days = durationEstimateDays(task);
  if (days != null && days > 0) return days * MS_PER_DAY;
  return MS_PER_DAY;
}

function inferStartFromDue(task: TaskRow, durMs: number): Date | null {
  if (!task.due_date?.trim()) return null;
  try {
    const due = parseLocalDate(task.due_date.trim());
    const dueEnd = endOfLocalDay(due);
    return new Date(dueEnd.getTime() - durMs);
  } catch {
    const d = new Date(`${task.due_date.trim()}T23:59:59`);
    return Number.isFinite(d.getTime()) ? new Date(d.getTime() - durMs) : null;
  }
}

function computeEndFromStart(start: Date, task: TaskRow): Date {
  if (task.planned_end_at?.trim()) {
    const e = new Date(task.planned_end_at);
    if (Number.isFinite(e.getTime()) && e.getTime() > start.getTime()) return e;
  }
  if (task.end_date?.trim()) {
    try {
      const e = parseLocalDate(task.end_date.trim());
      const endOfDay = endOfLocalDay(e);
      if (Number.isFinite(endOfDay.getTime()) && endOfDay.getTime() > start.getTime()) return endOfDay;
    } catch {
      const e = new Date(`${task.end_date.trim()}T23:59:59`);
      if (Number.isFinite(e.getTime()) && e.getTime() > start.getTime()) return e;
    }
  }
  return new Date(start.getTime() + durationMs(task));
}

function parseProjectBounds(projectStartDate?: string | null, projectEndDate?: string | null): { origin: Date; rangeEndExclusive: Date } | null {
  const s = projectStartDate?.trim();
  const e = projectEndDate?.trim();
  if (!s || !e) return null;
  try {
    const origin = startOfLocalDay(parseLocalDate(s));
    const endDay = startOfLocalDay(parseLocalDate(e));
    return { origin, rangeEndExclusive: new Date(endDay.getTime() + MS_PER_DAY) };
  } catch {
    const o = startOfLocalDay(new Date(s));
    const ed = startOfLocalDay(new Date(e));
    if (!Number.isFinite(o.getTime()) || !Number.isFinite(ed.getTime())) return null;
    return { origin: o, rangeEndExclusive: new Date(ed.getTime() + MS_PER_DAY) };
  }
}

/**
 * Derives `_start` / `_end` using project bounds when provided:
 * explicit start → due-date inference → sequential placement from project start.
 * Span prefers `estimated_completion_minutes`, then duration fields, then one day.
 */
export function normalizeTasks(tasks: TaskRow[], project?: { projectStartDate?: string | null; projectEndDate?: string | null } | null): GanttNormalizedTask[] {
  const bounds = project?.projectStartDate != null && project?.projectEndDate != null ? parseProjectBounds(project.projectStartDate, project.projectEndDate) : null;

  const fallbackOrigin = startOfLocalDay(new Date());
  const projectOriginMs = bounds?.origin.getTime() ?? fallbackOrigin.getTime();

  const sorted = [...tasks].sort((a, b) => {
    const ga = normLabel(a.phase_group).localeCompare(normLabel(b.phase_group), undefined, { sensitivity: "base" });
    if (ga !== 0) return ga;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });

  const implicitCursor = { t: projectOriginMs };

  return sorted.map((task) => {
    const dur = durationMs(task);
    let start = parseTaskStart(task) ?? inferStartFromDue(task, dur);
    if (!start) {
      start = new Date(Math.max(implicitCursor.t, projectOriginMs));
      implicitCursor.t = start.getTime() + dur + MS_GAP_IMPLICIT;
    }
    let end = computeEndFromStart(start, task);
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + dur);
    }
    return { ...task, _start: start, _end: end };
  });
}

function normLabel(s: string | null | undefined): string {
  return (s || "").trim();
}

function weekNumberSundayFirst(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((startOfLocalDay(d).getTime() - startOfLocalDay(oneJan).getTime()) / MS_PER_DAY);
  return Math.floor(days / 7) + 1;
}

type DayTick = { key: string; dayNum: number; monthKey: string; monthLabel: string; weekNum: number };

function buildDayTicks(viewStart: Date, viewEndExclusive: Date): DayTick[] {
  const ticks: DayTick[] = [];
  let d = new Date(viewStart);
  const end = viewEndExclusive.getTime();
  while (d.getTime() < end) {
    ticks.push({
      key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      dayNum: d.getDate(),
      monthKey: `${d.getFullYear()}-${d.getMonth()}`,
      monthLabel: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      weekNum: weekNumberSundayFirst(d),
    });
    d = new Date(d.getTime() + MS_PER_DAY);
  }
  return ticks;
}

function monthSpans(ticks: DayTick[]): { label: string; span: number }[] {
  const spans: { label: string; span: number }[] = [];
  for (const t of ticks) {
    const last = spans[spans.length - 1];
    if (last && last.label === t.monthLabel) last.span += 1;
    else spans.push({ label: t.monthLabel, span: 1 });
  }
  return spans;
}

type Props = {
  tasks: TaskRow[];
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  onTaskClick?: (task: TaskRow) => void;
};

export function GanttSchedule({ tasks, projectStartDate, projectEndDate, onTaskClick }: Props) {
  const project = useMemo(
    () => ({ projectStartDate: projectStartDate ?? null, projectEndDate: projectEndDate ?? null }),
    [projectStartDate, projectEndDate],
  );

  const normalized = useMemo(() => normalizeTasks(tasks, project), [tasks, project]);

  const cpm = useMemo(() => {
    const parsed = parseProjectBounds(project.projectStartDate, project.projectEndDate);
    return computeCPM(tasks, parsed?.origin ? { calendarProjectStart: parsed.origin } : undefined);
  }, [tasks, project.projectStartDate, project.projectEndDate]);

  const { viewStart, viewEndExclusive, timelineWidthPx, totalMs } = useMemo(() => {
    const parsed = parseProjectBounds(project.projectStartDate, project.projectEndDate);
    let vs = parsed?.origin ?? startOfLocalDay(new Date());
    let ve = parsed?.rangeEndExclusive ?? new Date(vs.getTime() + MS_PER_DAY * 14);

    for (const t of normalized) {
      vs = new Date(Math.min(vs.getTime(), t._start.getTime()));
      ve = new Date(Math.max(ve.getTime(), t._end.getTime()));
    }

    vs = startOfLocalDay(vs);
    ve = new Date(startOfLocalDay(ve).getTime() + MS_PER_DAY);

    const total = Math.max(MS_PER_DAY, ve.getTime() - vs.getTime());
    const tw = (total / MS_PER_DAY) * DAY_WIDTH_PX;
    return { viewStart: vs, viewEndExclusive: ve, timelineWidthPx: tw, totalMs: total };
  }, [normalized, project.projectStartDate, project.projectEndDate]);

  const ticks = useMemo(() => buildDayTicks(viewStart, viewEndExclusive), [viewStart, viewEndExclusive]);
  const months = useMemo(() => monthSpans(ticks), [ticks]);

  const groups = useMemo(() => {
    const g = new Map<string, GanttNormalizedTask[]>();
    for (const t of normalized) {
      const key = normLabel(t.phase_group) || "Tasks";
      g.set(key, [...(g.get(key) || []), t]);
    }
    return [...g.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [normalized]);

  const barLayout = (t: GanttNormalizedTask) => {
    const leftPx = ((t._start.getTime() - viewStart.getTime()) / totalMs) * timelineWidthPx;
    let widthPx = ((t._end.getTime() - t._start.getTime()) / totalMs) * timelineWidthPx;
    if (!Number.isFinite(leftPx)) return { leftPx: 0, widthPx: MIN_BAR_PX };
    if (!Number.isFinite(widthPx) || widthPx <= 0) widthPx = MIN_BAR_PX;
    widthPx = Math.max(MIN_BAR_PX, widthPx);
    return { leftPx, widthPx };
  };

  const now = Date.now();
  const showToday =
    Number.isFinite(now) && now >= viewStart.getTime() && now < viewEndExclusive.getTime();
  const todayLeftPx = showToday ? ((now - viewStart.getTime()) / totalMs) * timelineWidthPx : 0;

  const gridStyle = {
    backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent ${DAY_WIDTH_PX - 1}px, color-mix(in srgb, var(--ds-border) 50%, transparent) ${DAY_WIDTH_PX - 1}px, color-mix(in srgb, var(--ds-border) 50%, transparent) ${DAY_WIDTH_PX}px)`,
  } as const;

  if (tasks.length === 0) {
    return <p className="text-sm text-ds-muted">No tasks yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-ds-border bg-ds-secondary px-3 py-2 text-[11px] font-semibold text-ds-muted">
        Timeline: {viewStart.toLocaleDateString()} → {new Date(viewEndExclusive.getTime() - 1).toLocaleDateString()}
        {projectStartDate && projectEndDate ? (
          <span className="ml-2 text-ds-muted">(project window)</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-ds-border bg-ds-secondary/40 px-3 py-2 text-[10px] text-ds-muted">
        <span className="font-bold uppercase tracking-wide text-ds-foreground">Legend</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-6 rounded-sm ${TASK_CATEGORY_COLORS.planning}`} /> Planning
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-6 rounded-sm ${TASK_CATEGORY_COLORS.execution}`} /> Execution
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-6 rounded-sm ${TASK_CATEGORY_COLORS.cleanup}`} /> Cleanup
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-6 rounded-sm ${TASK_CATEGORY_COLORS.reflection}`} /> Reflection
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-6 rounded-sm border-2 border-red-500 bg-ds-gray-400" /> Critical
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-ds-border bg-white dark:bg-ds-primary">
        {/* Header */}
        <div className="flex min-w-max border-b border-ds-border bg-ds-secondary/80">
          <div
            className="sticky left-0 z-30 shrink-0 border-r border-ds-border bg-ds-secondary px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-ds-muted"
            style={{ width: SIDEBAR_W }}
          >
            Step / task
          </div>
          <div style={{ width: timelineWidthPx }} className="min-w-0">
            <div className="grid border-b border-ds-border" style={{ gridTemplateColumns: ticks.map(() => `${DAY_WIDTH_PX}px`).join(" ") }}>
              {months.map((m, i) => (
                <div
                  key={`m-${i}-${m.label}`}
                  className="border-r border-ds-border px-1 py-1 text-center text-[10px] font-semibold text-ds-foreground"
                  style={{ gridColumn: `span ${m.span}` }}
                >
                  {m.label}
                </div>
              ))}
            </div>
            <div className="grid" style={{ gridTemplateColumns: ticks.map(() => `${DAY_WIDTH_PX}px`).join(" ") }}>
              {ticks.map((tk) => (
                <div key={tk.key} className="border-r border-ds-border py-1 text-center text-[10px] text-ds-muted">
                  <div className="font-semibold text-ds-foreground">{tk.dayNum}</div>
                  <div className="text-[9px] opacity-80">w{tk.weekNum}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        {groups.map(([g, rows]) => {
          const sorted = rows.slice().sort((a, b) => a._start.getTime() - b._start.getTime());
          return (
            <div key={g}>
              <div className="flex min-w-max border-b border-ds-border bg-ds-secondary/50">
                <div
                  className="sticky left-0 z-20 shrink-0 border-r border-ds-border bg-ds-secondary/90 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ds-muted backdrop-blur-sm"
                  style={{ width: SIDEBAR_W }}
                >
                  {g}
                </div>
                <div style={{ width: timelineWidthPx }} className="bg-ds-secondary/30" />
              </div>
              {sorted.map((t) => {
                const { leftPx, widthPx } = barLayout(t);
                const rangeLabel = `${t._start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${t._end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
                return (
                  <div key={t.id} className="flex min-w-max border-b border-ds-border">
                    <button
                      type="button"
                      className="sticky left-0 z-20 shrink-0 border-r border-ds-border bg-ds-secondary px-3 py-2 text-left backdrop-blur-sm hover:bg-ds-interactive-hover"
                      style={{ width: SIDEBAR_W }}
                      onClick={() => onTaskClick?.(t)}
                    >
                      <div className="truncate text-sm font-semibold text-ds-foreground">{t.title}</div>
                      <div className="mt-0.5 text-[10px] text-ds-muted">{rangeLabel}</div>
                    </button>
                    <div className="relative py-2" style={{ width: timelineWidthPx }}>
                      <div className="relative mx-1 h-10 overflow-visible rounded-md border border-ds-border bg-white dark:bg-ds-primary" style={{ ...gridStyle }}>
                        {showToday ? (
                          <div
                            className="pointer-events-none absolute bottom-0 top-0 z-[2] w-px bg-sky-500/90"
                            style={{ left: todayLeftPx }}
                            title="Today"
                          />
                        ) : null}
                        <button
                          type="button"
                          className={[
                            "absolute top-1/2 z-[1] h-5 min-w-[10px] -translate-y-1/2 cursor-pointer rounded-sm border-0 p-0 shadow-sm transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                            TASK_CATEGORY_COLORS[normalizeTaskCategory(t)],
                            cpm.byId[t.id]?.isCritical ? "ring-2 ring-red-500 ring-offset-1 ring-offset-white dark:ring-offset-ds-primary" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={{ left: leftPx, width: widthPx } as CSSProperties}
                          title={`${t.title}: ${t._start.toLocaleString()} → ${t._end.toLocaleString()}`}
                          aria-label={`Open task ${t.title}`}
                          onClick={() => onTaskClick?.(t)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
