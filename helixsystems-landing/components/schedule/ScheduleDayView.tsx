"use client";

import { ChevronLeft, Plus } from "lucide-react";
import { useMemo } from "react";
import { getShiftConflicts, worstConflictSeverity } from "@/lib/schedule/conflicts";
import { setShiftDragData } from "@/lib/schedule/drag";
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

type Props = {
  open: boolean;
  date: string;
  onClose: () => void;
  shifts: Shift[];
  dayShiftsAll: Shift[];
  workers: Worker[];
  zones: Zone[];
  roles: ScheduleRoleDefinition[];
  shiftTypes: ShiftTypeConfig[];
  settings: ScheduleSettings;
  timeOffBlocks: TimeOffBlock[];
  onSelectShift: (shift: Shift) => void;
  onAddForDate: (iso: string) => void;
  onShiftDragStart: () => void;
  onShiftDragEnd: () => void;
};

/** Single-day drill-down: detailed list, same conflict + open-shift visuals, draggable chips (move/duplicate via month; trash via global drop zone). */
export function ScheduleDayView({
  open,
  date,
  onClose,
  shifts,
  dayShiftsAll,
  workers,
  zones,
  roles,
  shiftTypes,
  settings,
  timeOffBlocks,
  onSelectShift,
  onAddForDate,
  onShiftDragStart,
  onShiftDragEnd,
}: Props) {
  const typeMap = useMemo(() => new Map(shiftTypes.map((t) => [t.key, t])), [shiftTypes]);
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z.label])), [zones]);
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r.label])), [roles]);
  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);

  const sorted = useMemo(() => [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime)), [shifts]);

  const label = useMemo(() => {
    const d = new Date(date + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }, [date]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
        aria-label="Close day view"
        onClick={onClose}
      />
      <div className="relative max-h-[88vh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-slate-200/90 bg-white shadow-card-lg sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">Day view</p>
            <h2 className="truncate font-headline text-lg font-bold text-pulse-navy">{label}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white p-2 text-pulse-navy shadow-sm hover:bg-slate-50"
              onClick={() => onAddForDate(date)}
              aria-label="Add shift"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white p-2 text-pulse-navy shadow-sm hover:bg-slate-50"
              onClick={onClose}
              aria-label="Back to calendar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[min(72vh,520px)] space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
          {sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-pulse-muted">No shifts this day.</p>
          ) : (
            sorted.map((s) => {
              const st = typeMap.get(s.shiftType);
              const w = s.workerId ? workerMap.get(s.workerId) : null;
              const isOpen = !s.workerId;
              const name = w?.name ?? "Open shift";
              const zone = zoneMap.get(s.zoneId) ?? "—";
              const roleLb = roleMap.get(s.role) ?? s.role;
              const conflicts = getShiftConflicts(s, dayShiftsAll, workers, settings, timeOffBlocks);
              const sev = worstConflictSeverity(conflicts);
              const cls = st
                ? `${st.bg} ${st.border} ${st.text} border`
                : "border border-slate-200 bg-slate-50 text-pulse-navy";
              const openCls = isOpen ? "ring-2 ring-dashed ring-pulse-accent/45 ring-offset-2" : "";
              const title = conflicts.map((c) => c.label).join(" · ");

              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  draggable
                  className={`w-full rounded-xl px-3 py-3 text-left text-sm shadow-sm transition-opacity hover:brightness-[0.98] ${cls} ${openCls}`}
                  onClick={() => onSelectShift(s)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectShift(s);
                    }
                  }}
                  onDragStart={(e) => {
                    setShiftDragData(e.dataTransfer, {
                      shiftId: s.id,
                      duplicate: e.shiftKey,
                    });
                    onShiftDragStart();
                  }}
                  onDragEnd={onShiftDragEnd}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                        {isOpen ? (
                          <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pulse-accent">
                            Open
                          </span>
                        ) : null}
                        <span className="truncate">{name}</span>
                      </p>
                      <p className="mt-0.5 text-xs opacity-90">
                        {formatTimeRange(s.startTime, s.endTime, settings.timeFormat)}
                      </p>
                      <p className="text-xs opacity-90">
                        {roleLb} · {zone}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {s.uiFlags?.isNew ? (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-900">New</span>
                      ) : null}
                      {s.uiFlags?.isUpdated ? (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-900">
                          Updated
                        </span>
                      ) : null}
                      {sev ? (
                        <span
                          title={title}
                          className={`h-2.5 w-2.5 rounded-full ${sev === "critical" ? "bg-red-500" : "bg-amber-400"}`}
                          aria-label={title}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <p className="border-t border-slate-100 px-4 py-2 text-center text-[11px] text-pulse-muted">
          Drag to another day in the month view to reschedule. Hold Shift while dragging to duplicate. Drag to trash to
          delete.
        </p>
      </div>
    </div>
  );
}
