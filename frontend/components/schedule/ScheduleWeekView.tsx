"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { formatLocalDate, parseLocalDate, weekRangeLabel } from "@/lib/schedule/calendar";
import { getServerDate } from "@/lib/serverTime";
import { workerHighlightOverlayClass } from "@/lib/schedule/drag-highlight-classes";
import {
  readShiftDragPayload,
  readWorkerDragPayload,
  scheduleCalendarDragOverAccepts,
} from "@/lib/schedule/drag";
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

import { buildCompactDayShiftRows } from "@/lib/schedule/compact-day-shifts";
import { ScheduleCompactCellRows } from "./ScheduleCompactCellRows";

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
              className={`relative flex h-full min-h-0 flex-col bg-pulseShell-cell ${cellPointer} ${
                onOpenDay && !scheduleDragLock ? "cursor-pointer" : ""
              } ${isOver && !calendarDropsDisabled ? "ring-2 ring-inset ring-ds-success/40" : ""} ${
                shakeDate === date ? "schedule-cell-shake" : ""
              }`}
              onClick={(e) => {
                if (!onOpenDay || scheduleDragLock) return;
                if ((e.target as HTMLElement).closest("[data-schedule-interactive]")) return;
                onOpenDay(date);
              }}
              onDragOver={(e) => {
                if (calendarDropsDisabled) return;
                if (!scheduleCalendarDragOverAccepts(e, dragSession)) return;
                if (dragSession?.kind === "shift" && !shiftDragEnabled) return;
                e.preventDefault();
                if (dragSession?.kind === "worker") e.dataTransfer.dropEffect = "copy";
                else if (dragSession?.kind === "shift")
                  e.dataTransfer.dropEffect = dragSession.duplicate ? "copy" : "move";
                else {
                  const sp = readShiftDragPayload(e.dataTransfer);
                  const wp = readWorkerDragPayload(e.dataTransfer);
                  if (wp) e.dataTransfer.dropEffect = "copy";
                  else if (sp) e.dataTransfer.dropEffect = sp.duplicate ? "copy" : "move";
                  else e.dataTransfer.dropEffect = "move";
                }
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
                    data-schedule-interactive
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
                  data-schedule-interactive
                  className="rounded-md p-1 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-success"
                  aria-label={`Add shift on ${date}`}
                  onClick={() => onAddForDate(date)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <ScheduleCompactCellRows
                rows={buildCompactDayShiftRows(dayShifts, workers)}
                fullDayShifts={fullDay}
                workers={workers}
                zones={zones}
                roles={roles}
                shiftTypes={shiftTypes}
                settings={settings}
                timeOffBlocks={timeOffBlocks}
                onSelectShift={onSelectShift}
                scheduleDragLock={scheduleDragLock}
                dragSession={dragSession}
                shiftDragEnabled={shiftDragEnabled}
                onShiftDragSessionStart={onShiftDragSessionStart}
                onShiftDragSessionEnd={onShiftDragSessionEnd}
                chipDetailLevel="summary"
                scrollClassName="flex min-h-0 flex-1 flex-col gap-0.5 px-1 pb-1.5 pt-0.5"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
