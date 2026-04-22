"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { isLocalDateToday, monthGrid, monthLabel } from "@/lib/schedule/calendar";
import { workerHighlightOverlayClass } from "@/lib/schedule/drag-highlight-classes";
import {
  readShiftDragPayload,
  readWorkerDragPayload,
  scheduleCalendarDragOverAccepts,
} from "@/lib/schedule/drag";
import { evaluateWorkerDrop, type WorkerDayHighlight } from "@/lib/schedule/worker-drag-highlights";
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
  year: number;
  monthIndex: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
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
  /** Optional per-day background tint for lightweight project overlay (Tailwind classes). */
  projectDayTint?: Record<string, string>;
  /** While true, chrome is non-interactive; only day cells (drops) and shift chips respond as configured. */
  scheduleDragLock: boolean;
  dragSession: ScheduleDragSession | null;
  /** When true (e.g. trash hovered), day cells ignore drops. */
  calendarDropsDisabled: boolean;
  /** Organization setting: when false, shift chips cannot be dragged. */
  shiftDragEnabled?: boolean;
  workerHighlightByDate?: Record<string, WorkerDayHighlight> | null;
  onShiftDragSessionStart: (payload: ScheduleDragSession) => void;
  onShiftDragSessionEnd: () => void;
};

export function ScheduleCalendarGrid({
  year,
  monthIndex,
  onPrevMonth,
  onNextMonth,
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
  const cells = useMemo(() => monthGrid(year, monthIndex), [year, monthIndex]);
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
      const d = parseShiftMonth(s.date);
      if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    for (const [, list] of m) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return m;
  }, [shifts, year, monthIndex]);

  const dayShiftsFullDay = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts) {
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    return m;
  }, [shifts]);

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
        <h2 className="text-lg font-semibold text-ds-foreground">{monthLabel(year, monthIndex)}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-pulseShell-border bg-pulseShell-elevated p-2 text-ds-foreground shadow-sm hover:bg-ds-interactive-hover"
            onClick={onPrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-pulseShell-border bg-pulseShell-elevated p-2 text-ds-foreground shadow-sm hover:bg-ds-interactive-hover"
            onClick={onNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p
        className={`border-b border-pulseShell-border px-4 py-2 text-[11px] text-ds-muted sm:px-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        Drag a worker from the left panel to assign a shift (calendar highlights availability and certs). Drag a shift to move; hold{" "}
        <kbd className="rounded border border-pulseShell-border bg-pulseShell-kbd px-1 dark:border-pulseShell-border">Shift</kbd> to duplicate. Drop shifts on the trash
        target to delete.
      </p>
      <div
        className={`grid grid-cols-7 gap-px border-b border-pulseShell-border bg-pulseShell-grid ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        {WEEK.map((d) => (
          <div
            key={d}
            className="bg-pulseShell-header-row px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ds-muted"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-pulseShell-grid">
        {cells.map((c) => {
          const dayShifts = byDate.get(c.date) ?? [];
          const fullDay = dayShiftsFullDay.get(c.date) ?? [];
          const projectTint = projectDayTint?.[c.date];
          const isOver = dragOverDate === c.date;
          const isToday = isLocalDateToday(c.date);
          const hl = dragSession?.kind === "worker" ? workerHighlightByDate?.[c.date] : undefined;
          const hlLayer = hl ? workerHighlightOverlayClass(hl.tone) : "";
          return (
            <div
              key={c.date}
              title={dragSession?.kind === "worker" && hl?.tooltip ? hl.tooltip : undefined}
              aria-current={isToday ? "date" : undefined}
              className={`relative flex h-full min-h-0 flex-col bg-pulseShell-cell ${cellPointer} ${
                c.inMonth ? "" : "bg-pulseShell-cell-muted opacity-80"
              } ${c.inMonth && onOpenDay && !scheduleDragLock ? "cursor-pointer" : ""} ${
                isOver && !calendarDropsDisabled
                  ? "z-[1] ring-2 ring-inset ring-ds-success/50"
                  : isToday
                    ? "ring-2 ring-inset ring-ds-success/90"
                    : ""
              } ${shakeDate === c.date ? "schedule-cell-shake" : ""}`}
              onClick={(e) => {
                if (!c.inMonth || !onOpenDay || scheduleDragLock) return;
                if ((e.target as HTMLElement).closest("[data-schedule-interactive]")) return;
                onOpenDay(c.date);
              }}
              onDragOver={(e) => {
                if (calendarDropsDisabled) return;
                if (!scheduleCalendarDragOverAccepts(e, dragSession)) return;
                // Roster → calendar is always allowed; shift chip drag respects org "allow shift overrides".
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
                setDragOverDate(c.date);
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
                    const ev = evaluateWorkerDrop(w, c.date, shifts, settings, timeOffBlocks);
                    if (!ev.ok) {
                      triggerShake(c.date);
                      return;
                    }
                  }
                  onWorkerDrop(wp.workerId, c.date);
                  return;
                }
                if (!shiftDragEnabled) return;
                const p = readShiftDragPayload(e.dataTransfer);
                if (p) {
                  onShiftMove(p.shiftId, c.date, p.duplicate ? "duplicate" : "move");
                }
              }}
            >
              {hlLayer ? (
                <div className={`pointer-events-none absolute inset-0 z-0 rounded-sm ${hlLayer}`} aria-hidden />
              ) : null}
              {projectTint ? (
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 z-[1] h-1.5 rounded-sm ${projectTint}`}
                  aria-hidden
                  title="Project block"
                />
              ) : null}
              <div
                className={`relative z-[2] flex items-center justify-between gap-1 border-b border-transparent px-1.5 pt-1.5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
              >
                {c.inMonth && onOpenDay ? (
                  <button
                    type="button"
                    data-schedule-interactive
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold hover:bg-ds-interactive-hover ${
                      c.inMonth ? "text-ds-foreground" : "text-ds-muted"
                    }`}
                    onClick={() => onOpenDay(c.date)}
                    aria-label={`Open day view for ${c.date}`}
                  >
                    {c.dayOfMonth}
                  </button>
                ) : (
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      c.inMonth ? "text-ds-foreground" : "text-ds-muted"
                    }`}
                  >
                    {c.dayOfMonth}
                  </span>
                )}
                {c.inMonth ? (
                  <button
                    type="button"
                    data-schedule-interactive
                    className="rounded-md p-1 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-success"
                    aria-label={`Add shift on ${c.date}`}
                    onClick={() => onAddForDate(c.date)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                ) : null}
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

function parseShiftMonth(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
