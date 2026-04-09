"use client";

import { Award, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { formatLocalDate, parseLocalDate, weekRangeLabel } from "@/lib/schedule/calendar";
import { getServerDate } from "@/lib/serverTime";
import { scheduleShiftHoverSummary, shiftHasCertificationFlag } from "@/lib/schedule/certifications";
import { getShiftConflicts, worstConflictSeverity } from "@/lib/schedule/conflicts";
import { workerHighlightOverlayClass } from "@/lib/schedule/drag-highlight-classes";
import {
  attachShiftDragPreview,
  readShiftDragPayload,
  readWorkerDragPayload,
  setShiftDragData,
  SHIFT_DRAG_MIME,
  WORKER_DRAG_MIME,
} from "@/lib/schedule/drag";
import { formatTimeRange } from "@/lib/schedule/time-format";
import { evaluateWorkerDrop } from "@/lib/schedule/worker-drag-highlights";
import type { WorkerDayHighlight } from "@/lib/schedule/worker-drag-highlights";
import type {
  ScheduleDragSession,
  ScheduleRoleDefinition,
  ScheduleSettings,
  Shift,
  ShiftTypeConfig,
  TimeOffBlock,
  Worker,
  Zone,
} from "@/lib/schedule/types";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  weekDates: string[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  shifts: Shift[];
  workers: Worker[];
  zones: Zone[];
  roles: ScheduleRoleDefinition[];
  shiftTypes: ShiftTypeConfig[];
  settings: ScheduleSettings;
  timeOffBlocks: TimeOffBlock[];
  onSelectShift: (shift: Shift) => void;
  onAddForDate: (iso: string) => void;
  onShiftMove: (shiftId: string, targetDate: string, mode: "move" | "duplicate") => void;
  onWorkerDrop: (workerId: string, targetDate: string) => void;
  onOpenDay?: (iso: string) => void;
  projectDayTint?: Record<string, string>;
  scheduleDragLock: boolean;
  dragSession: ScheduleDragSession | null;
  calendarDropsDisabled: boolean;
  shiftDragEnabled?: boolean;
  workerHighlightByDate?: Record<string, WorkerDayHighlight> | null;
  onShiftDragSessionStart: (payload: ScheduleDragSession) => void;
  onShiftDragSessionEnd: () => void;
};

export function ScheduleWeekView({
  weekDates,
  onPrevWeek,
  onNextWeek,
  onToday,
  shifts,
  workers,
  zones,
  roles,
  shiftTypes,
  settings,
  timeOffBlocks,
  onSelectShift,
  onAddForDate,
  onShiftMove,
  onWorkerDrop,
  onOpenDay,
  projectDayTint,
  scheduleDragLock,
  dragSession,
  calendarDropsDisabled,
  shiftDragEnabled = true,
  workerHighlightByDate = null,
  onShiftDragSessionStart,
  onShiftDragSessionEnd,
}: Props) {
  const typeMap = useMemo(() => new Map(shiftTypes.map((t) => [t.key, t])), [shiftTypes]);
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z.label])), [zones]);
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r.label])), [roles]);
  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [shakeDate, setShakeDate] = useState<string | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerShake = (date: string) => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShakeDate(date);
    shakeTimer.current = setTimeout(() => {
      setShakeDate(null);
      shakeTimer.current = null;
    }, 420);
  };

  const byDate = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts) {
      if (!weekDates.includes(s.date)) continue;
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    for (const [, list] of m) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return m;
  }, [shifts, weekDates]);

  const dayShiftsFullDay = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts) {
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    return m;
  }, [shifts]);

  const label = weekRangeLabel(weekDates);
  const cellPointer = scheduleDragLock
    ? calendarDropsDisabled
      ? "pointer-events-none"
      : "pointer-events-auto"
    : "";

  const dragAccepts = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(SHIFT_DRAG_MIME) || e.dataTransfer.types.includes(WORKER_DRAG_MIME)) {
      return true;
    }
    return e.dataTransfer.types.includes("text/plain");
  };

  return (
    <div
      className={`rounded-md border border-pulseShell-border bg-pulseShell-surface shadow-[var(--pulse-shell-shadow)] ${scheduleDragLock ? "pointer-events-none" : ""}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-pulseShell-border px-4 py-3 sm:px-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        <h2 className="text-lg font-semibold text-ds-foreground">{label}</h2>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-pulseShell-border bg-pulseShell-elevated px-2 py-1.5 text-xs font-semibold text-ds-foreground shadow-sm hover:bg-ds-interactive-hover"
            onClick={onToday}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-lg border border-pulseShell-border bg-pulseShell-elevated p-2 text-ds-foreground shadow-sm hover:bg-ds-interactive-hover"
            onClick={onPrevWeek}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-pulseShell-border bg-pulseShell-elevated p-2 text-ds-foreground shadow-sm hover:bg-ds-interactive-hover"
            onClick={onNextWeek}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p
        className={`border-b border-pulseShell-border px-4 py-2 text-[11px] text-ds-muted sm:px-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        Week view — drag workers from the roster or move shift chips between days.
      </p>
      <div
        className={`grid grid-cols-7 gap-px overflow-x-auto border-b border-pulseShell-border bg-pulseShell-grid ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        {weekDates.map((date, idx) => {
          const dow = WEEK[idx];
          const d = parseLocalDate(date);
          const isToday = formatLocalDate(getServerDate()) === date;
          return (
            <div
              key={date}
              className={`bg-pulseShell-header-row px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide ${
                isToday ? "text-ds-success" : "text-ds-muted"
              }`}
            >
              <div>{dow}</div>
              <div className="mt-0.5 tabular-nums text-ds-foreground">
                {d.getMonth() + 1}/{d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid min-w-[640px] grid-cols-7 gap-px bg-pulseShell-grid">
        {weekDates.map((date) => {
          const dayShifts = byDate.get(date) ?? [];
          const fullDay = dayShiftsFullDay.get(date) ?? [];
          const projectTint = projectDayTint?.[date];
          const isOver = dragOverDate === date;
          const hl = dragSession?.kind === "worker" ? workerHighlightByDate?.[date] : undefined;
          const hlLayer = hl ? workerHighlightOverlayClass(hl.tone) : "";
          const d = parseLocalDate(date);
          return (
            <div
              key={date}
              title={dragSession?.kind === "worker" && hl?.tooltip ? hl.tooltip : undefined}
              className={`relative flex min-h-[14rem] flex-col bg-pulseShell-cell ${cellPointer} ${
                isOver && !calendarDropsDisabled ? "ring-2 ring-inset ring-ds-success/40" : ""
              } ${shakeDate === date ? "schedule-cell-shake" : ""}`}
              onDragOver={(e) => {
                if (calendarDropsDisabled) return;
                if (!dragAccepts(e)) return;
                if (dragSession?.kind === "shift" && !shiftDragEnabled) return;
                e.preventDefault();
                const sp = readShiftDragPayload(e.dataTransfer);
                const wp = readWorkerDragPayload(e.dataTransfer);
                if (wp) e.dataTransfer.dropEffect = "copy";
                else if (sp) e.dataTransfer.dropEffect = sp.duplicate ? "copy" : "move";
                else e.dataTransfer.dropEffect = "move";
                setDragOverDate(date);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOverDate(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverDate(null);
                if (calendarDropsDisabled) return;
                const wp = readWorkerDragPayload(e.dataTransfer);
                if (wp) {
                  const w = workers.find((x) => x.id === wp.workerId);
                  if (w) {
                    const ev = evaluateWorkerDrop(w, date, shifts, settings, timeOffBlocks);
                    if (!ev.ok) {
                      triggerShake(date);
                      return;
                    }
                  }
                  onWorkerDrop(wp.workerId, date);
                  return;
                }
                if (!shiftDragEnabled) return;
                const p = readShiftDragPayload(e.dataTransfer);
                if (p) onShiftMove(p.shiftId, date, p.duplicate ? "duplicate" : "move");
              }}
            >
              {hlLayer ? (
                <div className={`pointer-events-none absolute inset-0 z-0 rounded-sm ${hlLayer}`} aria-hidden />
              ) : null}
              {projectTint ? (
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 z-[1] h-1.5 rounded-sm ${projectTint}`}
                  aria-hidden
                />
              ) : null}
              <div
                className={`relative z-[2] flex items-center justify-between gap-1 border-b border-transparent px-1.5 pt-1.5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
              >
                {onOpenDay ? (
                  <button
                    type="button"
                    className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
                    onClick={() => onOpenDay(date)}
                    aria-label={`Open day view for ${date}`}
                  >
                    {d.getDate()}
                  </button>
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center text-xs font-semibold text-ds-foreground">
                    {d.getDate()}
                  </span>
                )}
                <button
                  type="button"
                  className="rounded-md p-1 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-success"
                  aria-label={`Add shift on ${date}`}
                  onClick={() => onAddForDate(date)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="relative z-[2] flex max-h-[20rem] flex-1 flex-col gap-1 overflow-y-auto px-1 pb-2 pt-1">
                {dayShifts.map((s) => {
                  const st = typeMap.get(s.shiftType);
                  const w = s.workerId ? workerMap.get(s.workerId) : null;
                  const isOpen = !s.workerId;
                  const rawName =
                    s.shiftKind === "project_task" && s.taskTitle ? s.taskTitle : (w?.name ?? "Open");
                  const displayName =
                    s.eventType === "vacation" ? "Vacation" : s.eventType === "sick" ? "Sick leave" : rawName;
                  const zone = zoneMap.get(s.zoneId) ?? "—";
                  const roleLb = roleMap.get(s.role) ?? s.role;
                  const cls = st
                    ? `${st.bg} ${st.border} ${st.text} border`
                    : "border border-pulseShell-border bg-pulseShell-elevated text-ds-foreground";
                  const ptoCls =
                    s.eventType === "vacation"
                      ? "border-[color-mix(in_srgb,var(--ds-warning)_38%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-warning)_18%,var(--ds-surface-primary))] text-ds-foreground"
                      : s.eventType === "sick"
                        ? "border-[color-mix(in_srgb,var(--ds-danger)_32%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-danger)_15%,var(--ds-surface-primary))] text-ds-foreground"
                        : "";
                  const chipBaseCls = ptoCls || cls;
                  const openCls = isOpen
                    ? "ring-2 ring-dashed ring-ds-success/45 ring-offset-1 ring-offset-pulse-shell-cell dark:ring-offset-pulse-shell-cell"
                    : "";
                  const conflicts = getShiftConflicts(s, fullDay, workers, settings, timeOffBlocks, zones);
                  const sev = worstConflictSeverity(conflicts);
                  const tip = scheduleShiftHoverSummary(s, w, conflicts);
                  const certFlag = shiftHasCertificationFlag(conflicts);
                  const chipLocked =
                    scheduleDragLock &&
                    (dragSession?.kind === "worker" ||
                      (dragSession?.kind === "shift" && dragSession.shiftId !== s.id));
                  const canDrag =
                    shiftDragEnabled &&
                    !s.autoGenerated &&
                    (!scheduleDragLock || (dragSession?.kind === "shift" && dragSession.shiftId === s.id));

                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      draggable={canDrag}
                      className={`w-full rounded-lg px-1.5 py-1.5 text-left text-[11px] leading-snug shadow-sm transition-colors hover:brightness-[0.97] ${
                        s.autoGenerated ? "opacity-[0.92]" : ""
                      } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${chipLocked ? "pointer-events-none" : ""} ${chipBaseCls} ${openCls}`}
                      onClick={() => {
                        if (scheduleDragLock || s.autoGenerated) return;
                        onSelectShift(s);
                      }}
                      onKeyDown={(e) => {
                        if (scheduleDragLock || s.autoGenerated) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectShift(s);
                        }
                      }}
                      onDragStart={(e) => {
                        if (!shiftDragEnabled || s.autoGenerated) {
                          e.preventDefault();
                          return;
                        }
                        const dup = e.shiftKey;
                        setShiftDragData(e.dataTransfer, { shiftId: s.id, duplicate: dup });
                        attachShiftDragPreview(e, dup);
                        onShiftDragSessionStart({ kind: "shift", shiftId: s.id, duplicate: dup });
                      }}
                      onDragEnd={onShiftDragSessionEnd}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1 truncate font-semibold">
                            {isOpen ? (
                              <span className="shrink-0 rounded bg-[color-mix(in_srgb,var(--ds-success)_18%,var(--ds-surface-elevated))] px-0.5 text-[9px] font-bold uppercase text-ds-success">
                                Open
                              </span>
                            ) : null}
                            <span className="truncate">{displayName}</span>
                          </p>
                          <p className="truncate opacity-90">
                            {formatTimeRange(s.startTime, s.endTime, settings.timeFormat)}
                          </p>
                          <p className="truncate text-[10px] opacity-90">
                            {s.shiftKind === "project_task" && s.projectName
                              ? `${s.projectName} · ${zone}`
                              : `${roleLb} · ${zone}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          {s.autoGenerated ? (
                            <span className="text-[8px] font-bold uppercase text-ds-muted">Auto</span>
                          ) : null}
                          <div className="flex items-center gap-0.5">
                            {certFlag ? (
                              <span title={tip} className="inline-flex">
                                <Award className="h-3 w-3 shrink-0 text-ds-muted" strokeWidth={2} aria-hidden />
                              </span>
                            ) : null}
                            {sev ? (
                              <span
                                title={tip}
                                className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                                  sev === "critical" ? "bg-ds-danger" : "bg-ds-warning"
                                }`}
                              />
                            ) : null}
                          </div>
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
    </div>
  );
}
