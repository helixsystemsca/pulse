"use client";

import { Award, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { monthGrid, monthLabel } from "@/lib/schedule/calendar";
import { scheduleShiftHoverSummary, shiftHasCertificationFlag } from "@/lib/schedule/certifications";
import { getShiftConflicts, worstConflictSeverity } from "@/lib/schedule/conflicts";
import { attachShiftDragPreview, readShiftDragPayload, setShiftDragData, SHIFT_DRAG_MIME } from "@/lib/schedule/drag";
import { formatTimeRange } from "@/lib/schedule/time-format";
import type {
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
  onOpenDay?: (iso: string) => void;
  /** Optional per-day background tint for lightweight project overlay (Tailwind classes). */
  projectDayTint?: Record<string, string>;
  /** While true, chrome is non-interactive; only day cells (drops) and shift chips respond as configured. */
  scheduleDragLock: boolean;
  /** Active shift drag (for per-chip pointer-events / draggable). */
  dragSession: { shiftId: string; duplicate: boolean } | null;
  /** When true (e.g. trash hovered), day cells ignore drops. */
  calendarDropsDisabled: boolean;
  onShiftDragSessionStart: (payload: { shiftId: string; duplicate: boolean }) => void;
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
  onOpenDay,
  projectDayTint,
  scheduleDragLock,
  dragSession,
  calendarDropsDisabled,
  onShiftDragSessionStart,
  onShiftDragSessionEnd,
}: Props) {
  const cells = useMemo(() => monthGrid(year, monthIndex), [year, monthIndex]);
  const typeMap = useMemo(() => new Map(shiftTypes.map((t) => [t.key, t])), [shiftTypes]);
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z.label])), [zones]);
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r.label])), [roles]);
  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

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
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${scheduleDragLock ? "pointer-events-none" : ""}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-[#1F2937] sm:px-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{monthLabel(year, monthIndex)}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-900 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#111827]"
            onClick={onPrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-900 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#111827]"
            onClick={onNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p
        className={`border-b border-gray-200 px-4 py-2 text-[11px] text-gray-500 dark:border-[#1F2937] dark:text-gray-400 sm:px-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        Drag a shift to another day to move it. Hold{" "}
        <kbd className="rounded bg-gray-100 px-1 dark:bg-[#0F172A]">Shift</kbd> while dragging to duplicate. Drop on the
        trash target (bottom-right) to delete.
      </p>
      <div
        className={`grid grid-cols-7 gap-px border-b border-gray-200 bg-gray-200/80 dark:border-[#1F2937] dark:bg-[#1F2937] ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        {WEEK.map((d) => (
          <div
            key={d}
            className="bg-gray-50/90 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-[#0F172A] dark:text-gray-400"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200/80 dark:bg-[#1F2937]">
        {cells.map((c) => {
          const dayShifts = byDate.get(c.date) ?? [];
          const fullDay = dayShiftsFullDay.get(c.date) ?? [];
          const projectTint = projectDayTint?.[c.date];
          const isOver = dragOverDate === c.date;
          return (
            <div
              key={c.date}
              className={`relative flex min-h-[7.5rem] flex-col bg-white ${cellPointer} ${
                c.inMonth ? "" : "bg-gray-50/50 opacity-80 dark:bg-[#0B0F14]/40"
              } ${isOver && !calendarDropsDisabled ? "ring-2 ring-inset ring-blue-500/40 dark:ring-blue-400/45" : ""}`}
              onDragOver={(e) => {
                if (calendarDropsDisabled) return;
                if (e.dataTransfer.types.includes(SHIFT_DRAG_MIME) || e.dataTransfer.types.includes("text/plain")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = readShiftDragPayload(e.dataTransfer)?.duplicate ? "copy" : "move";
                  setDragOverDate(c.date);
                }
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOverDate(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverDate(null);
                if (calendarDropsDisabled) return;
                const p = readShiftDragPayload(e.dataTransfer);
                if (p) {
                  onShiftMove(p.shiftId, c.date, p.duplicate ? "duplicate" : "move");
                }
              }}
            >
              {projectTint ? (
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 rounded-sm ${projectTint}`}
                  aria-hidden
                  title="Project block"
                />
              ) : null}
              <div
                className={`flex items-center justify-between gap-1 border-b border-transparent px-1.5 pt-1.5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
              >
                {c.inMonth && onOpenDay ? (
                  <button
                    type="button"
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold hover:bg-gray-100 dark:hover:bg-[#0F172A] ${
                      c.inMonth ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"
                    }`}
                    onClick={() => onOpenDay(c.date)}
                    aria-label={`Open day view for ${c.date}`}
                  >
                    {c.dayOfMonth}
                  </button>
                ) : (
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      c.inMonth ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {c.dayOfMonth}
                  </span>
                )}
                {c.inMonth ? (
                  <button
                    type="button"
                    className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-[#0F172A] dark:hover:text-blue-400"
                    aria-label={`Add shift on ${c.date}`}
                    onClick={() => onAddForDate(c.date)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="relative flex max-h-[11rem] flex-1 flex-col gap-1 overflow-y-auto px-1 pb-2 pt-1">
                {dayShifts.map((s) => {
                  const st = typeMap.get(s.shiftType);
                  const w = s.workerId ? workerMap.get(s.workerId) : null;
                  const isOpen = !s.workerId;
                  const name =
                    s.shiftKind === "project_task" && s.taskTitle
                      ? s.taskTitle
                      : (w?.name ?? "Open");
                  const zone = zoneMap.get(s.zoneId) ?? "—";
                  const roleLb = roleMap.get(s.role) ?? s.role;
                  const cls = st
                    ? `${st.bg} ${st.border} ${st.text} border`
                    : "border border-gray-200 bg-gray-50 text-gray-900 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100";
                  const openCls = isOpen
                    ? "ring-2 ring-dashed ring-blue-500/40 ring-offset-1 ring-offset-white dark:ring-blue-400/45 dark:ring-offset-[#111827]"
                    : "";
                  const conflicts = getShiftConflicts(s, fullDay, workers, settings, timeOffBlocks, zones);
                  const sev = worstConflictSeverity(conflicts);
                  const tip = scheduleShiftHoverSummary(s, w, conflicts);
                  const certFlag = shiftHasCertificationFlag(conflicts);

                  const chipLocked =
                    scheduleDragLock && dragSession !== null && dragSession.shiftId !== s.id;
                  const canDrag = !scheduleDragLock || dragSession?.shiftId === s.id;

                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      draggable={canDrag}
                      className={`w-full rounded-lg px-1.5 py-1.5 text-left text-[11px] leading-snug shadow-sm transition-colors hover:brightness-[0.97] ${
                        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                      } ${chipLocked ? "pointer-events-none" : ""} ${cls} ${openCls}`}
                      onClick={() => {
                        if (scheduleDragLock) return;
                        onSelectShift(s);
                      }}
                      onKeyDown={(e) => {
                        if (scheduleDragLock) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectShift(s);
                        }
                      }}
                      onDragStart={(e) => {
                        const dup = e.shiftKey;
                        setShiftDragData(e.dataTransfer, { shiftId: s.id, duplicate: dup });
                        attachShiftDragPreview(e, dup);
                        onShiftDragSessionStart({ shiftId: s.id, duplicate: dup });
                      }}
                      onDragEnd={onShiftDragSessionEnd}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1 truncate font-semibold">
                            {isOpen ? (
                              <span className="shrink-0 rounded bg-white/60 px-0.5 text-[9px] font-bold uppercase text-blue-600 dark:bg-white/10 dark:text-blue-400">
                                Open
                              </span>
                            ) : null}
                            <span className="truncate">{name}</span>
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
                          {s.uiFlags?.isNew ? (
                            <span className="text-[8px] font-bold uppercase text-blue-700">New</span>
                          ) : null}
                          {s.uiFlags?.isUpdated ? (
                            <span className="text-[8px] font-bold uppercase text-violet-700">Chg</span>
                          ) : null}
                          <div className="flex items-center gap-0.5">
                            {certFlag ? (
                              <span title={tip} className="inline-flex">
                                <Award className="h-3 w-3 shrink-0 text-gray-500 dark:text-gray-400" strokeWidth={2} aria-hidden />
                              </span>
                            ) : null}
                            {sev ? (
                              <span
                                title={tip}
                                className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                                  sev === "critical" ? "bg-red-500" : "bg-amber-400"
                                }`}
                                aria-label={tip}
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

function parseShiftMonth(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
