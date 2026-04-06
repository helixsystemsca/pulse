"use client";

import { Award, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { formatLocalDate, parseLocalDate, weekRangeLabel } from "@/lib/schedule/calendar";
import { getServerDate } from "@/lib/serverTime";
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
  onOpenDay?: (iso: string) => void;
  projectDayTint?: Record<string, string>;
  scheduleDragLock: boolean;
  dragSession: { shiftId: string; duplicate: boolean } | null;
  calendarDropsDisabled: boolean;
  onShiftDragSessionStart: (payload: { shiftId: string; duplicate: boolean }) => void;
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
  onOpenDay,
  projectDayTint,
  scheduleDragLock,
  dragSession,
  calendarDropsDisabled,
  onShiftDragSessionStart,
  onShiftDragSessionEnd,
}: Props) {
  const typeMap = useMemo(() => new Map(shiftTypes.map((t) => [t.key, t])), [shiftTypes]);
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z.label])), [zones]);
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r.label])), [roles]);
  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

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
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${scheduleDragLock ? "pointer-events-none" : ""}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-[#1F2937] sm:px-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{label}</h2>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#111827]"
            onClick={onToday}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-900 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#111827]"
            onClick={onPrevWeek}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-900 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#111827]"
            onClick={onNextWeek}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p
        className={`border-b border-gray-200 px-4 py-2 text-[11px] text-gray-500 dark:border-[#1F2937] dark:text-gray-400 sm:px-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        Week view — same drag, drop, and shift actions as the month grid.
      </p>
      <div
        className={`grid grid-cols-7 gap-px overflow-x-auto border-b border-gray-200 bg-gray-200/80 dark:border-[#1F2937] dark:bg-[#1F2937] ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        {weekDates.map((date, idx) => {
          const dow = WEEK[idx];
          const d = parseLocalDate(date);
          const isToday = formatLocalDate(getServerDate()) === date;
          return (
            <div
              key={date}
              className={`bg-gray-50/90 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide dark:bg-[#0F172A] ${
                isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <div>{dow}</div>
              <div className="mt-0.5 tabular-nums text-gray-900 dark:text-gray-100">
                {d.getMonth() + 1}/{d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid min-w-[640px] grid-cols-7 gap-px bg-gray-200/80 dark:bg-[#1F2937]">
        {weekDates.map((date) => {
          const dayShifts = byDate.get(date) ?? [];
          const fullDay = dayShiftsFullDay.get(date) ?? [];
          const projectTint = projectDayTint?.[date];
          const isOver = dragOverDate === date;
          const d = parseLocalDate(date);
          return (
            <div
              key={date}
              className={`relative flex min-h-[14rem] flex-col bg-white ${cellPointer} ${
                isOver && !calendarDropsDisabled
                  ? "ring-2 ring-inset ring-blue-500/40 dark:ring-blue-400/45"
                  : ""
              }`}
              onDragOver={(e) => {
                if (calendarDropsDisabled) return;
                if (e.dataTransfer.types.includes(SHIFT_DRAG_MIME) || e.dataTransfer.types.includes("text/plain")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = readShiftDragPayload(e.dataTransfer)?.duplicate ? "copy" : "move";
                  setDragOverDate(date);
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
                if (p) onShiftMove(p.shiftId, date, p.duplicate ? "duplicate" : "move");
              }}
            >
              {projectTint ? (
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 rounded-sm ${projectTint}`}
                  aria-hidden
                />
              ) : null}
              <div
                className={`flex items-center justify-between gap-1 border-b border-transparent px-1.5 pt-1.5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
              >
                {onOpenDay ? (
                  <button
                    type="button"
                    className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full text-xs font-semibold text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-[#0F172A]"
                    onClick={() => onOpenDay(date)}
                    aria-label={`Open day view for ${date}`}
                  >
                    {d.getDate()}
                  </button>
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {d.getDate()}
                  </span>
                )}
                <button
                  type="button"
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-[#0F172A] dark:hover:text-blue-400"
                  aria-label={`Add shift on ${date}`}
                  onClick={() => onAddForDate(date)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="relative flex max-h-[20rem] flex-1 flex-col gap-1 overflow-y-auto px-1 pb-2 pt-1">
                {dayShifts.map((s) => {
                  const st = typeMap.get(s.shiftType);
                  const w = s.workerId ? workerMap.get(s.workerId) : null;
                  const isOpen = !s.workerId;
                  const name =
                    s.shiftKind === "project_task" && s.taskTitle ? s.taskTitle : (w?.name ?? "Open");
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
                  const chipLocked = scheduleDragLock && dragSession !== null && dragSession.shiftId !== s.id;
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
