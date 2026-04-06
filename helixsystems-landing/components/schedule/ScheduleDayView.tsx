"use client";

import { AlertTriangle, ArrowLeft, Award, Plus } from "lucide-react";
import { useMemo } from "react";
import {
  formatCertCodesShort,
  formatCertCodesWithLabels,
  scheduleShiftHoverSummary,
  shiftHasCertificationFlag,
} from "@/lib/schedule/certifications";
import { getShiftConflicts, worstConflictSeverity } from "@/lib/schedule/conflicts";
import { attachShiftDragPreview, setShiftDragData } from "@/lib/schedule/drag";
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
  scheduleDragLock: boolean;
  dragSession: { shiftId: string; duplicate: boolean } | null;
  onShiftDragSessionStart: (payload: { shiftId: string; duplicate: boolean }) => void;
  onShiftDragSessionEnd: () => void;
};

/**
 * Full-panel single-day workspace: same shift visuals and conflict hints as the month grid; chips stay draggable (trash + calendar drops use the global session).
 */
export function ScheduleDayView({
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
  scheduleDragLock,
  dragSession,
  onShiftDragSessionStart,
  onShiftDragSessionEnd,
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

  const conflictSummary = useMemo(() => {
    let withIssues = 0;
    let shiftsWithCritical = 0;
    const labels = new Set<string>();
    for (const s of sorted) {
      const c = getShiftConflicts(s, dayShiftsAll, workers, settings, timeOffBlocks, zones);
      if (!c.length) continue;
      withIssues += 1;
      if (c.some((x) => x.severity === "critical")) shiftsWithCritical += 1;
      for (const x of c) labels.add(x.label);
    }
    return {
      withIssues,
      shiftsWithCritical,
      labels: [...labels].slice(0, 6),
      totalLabels: labels.size,
    };
  }, [sorted, dayShiftsAll, workers, settings, timeOffBlocks, zones]);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
      <div
        className={`flex flex-col gap-4 border-b border-gray-200 px-4 py-4 dark:border-[#1F2937] sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <button
            type="button"
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#111827]"
            onClick={onClose}
            aria-label="Back to calendar"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Calendar
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Day workspace</p>
            <h2 className="font-headline text-xl font-bold tracking-tight text-gray-900 dark:text-white">{label}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {sorted.length} shift{sorted.length === 1 ? "" : "s"} · edit, drag to reschedule, or drop on trash to
              delete.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            onClick={() => onAddForDate(date)}
            aria-label="Add shift"
          >
            <Plus className="h-4 w-4" />
            Add shift
          </button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-h-[16rem] border-b border-gray-200 dark:border-[#1F2937] lg:border-b-0 lg:border-r">
          <div className="max-h-[min(70vh,640px)] space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
            {sorted.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No shifts this day.</p>
            ) : (
              sorted.map((s) => {
                const st = typeMap.get(s.shiftType);
                const w = s.workerId ? workerMap.get(s.workerId) : null;
                const isOpen = !s.workerId;
                const name =
                  s.shiftKind === "project_task" && s.taskTitle ? s.taskTitle : (w?.name ?? "Open shift");
                const zone = zoneMap.get(s.zoneId) ?? "—";
                const roleLb = roleMap.get(s.role) ?? s.role;
                const conflicts = getShiftConflicts(s, dayShiftsAll, workers, settings, timeOffBlocks, zones);
                const sev = worstConflictSeverity(conflicts);
                const hoverTip = scheduleShiftHoverSummary(s, w, conflicts);
                const certFlag = shiftHasCertificationFlag(conflicts);
                const certRows = conflicts.filter((c) => c.type === "certification");
                const otherRows = conflicts.filter((c) => c.type !== "certification");
                const req = s.required_certifications?.filter(Boolean) ?? [];
                const acceptAny = s.accepts_any_certification === true;
                const cls = st
                  ? `${st.bg} ${st.border} ${st.text} border`
                  : "border border-gray-200 bg-gray-50 text-gray-900 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100";
                const openCls = isOpen
                  ? "ring-2 ring-dashed ring-blue-500/45 ring-offset-2 ring-offset-white dark:ring-blue-400/45 dark:ring-offset-[#111827]"
                  : "";
                const chipLocked = scheduleDragLock && dragSession !== null && dragSession.shiftId !== s.id;
                const canDrag = !scheduleDragLock || dragSession?.shiftId === s.id;

                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    draggable={canDrag}
                    className={`w-full rounded-xl px-3 py-3 text-left text-sm shadow-sm transition-opacity hover:brightness-[0.98] ${
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
                      setShiftDragData(e.dataTransfer, {
                        shiftId: s.id,
                        duplicate: dup,
                      });
                      attachShiftDragPreview(e, dup);
                      onShiftDragSessionStart({ shiftId: s.id, duplicate: dup });
                    }}
                    onDragEnd={onShiftDragSessionEnd}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                          {isOpen ? (
                            <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:bg-white/10 dark:text-blue-400">
                              Open
                            </span>
                          ) : null}
                          <span className="truncate">{name}</span>
                        </p>
                        <p className="mt-0.5 text-xs opacity-90">
                          {formatTimeRange(s.startTime, s.endTime, settings.timeFormat)}
                        </p>
                        <p className="text-xs opacity-90">
                          {s.shiftKind === "project_task" && s.projectName
                            ? `${s.projectName} · ${zone}`
                            : `${roleLb} · ${zone}`}
                        </p>
                        {req.length ? (
                          <p className="mt-1.5 text-xs leading-snug">
                            <span className="font-semibold text-gray-500 dark:text-gray-400">Required: </span>
                            <span className="text-gray-900 dark:text-gray-100">{formatCertCodesShort(req)}</span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {" "}
                              ({acceptAny ? "any one" : "all"}: {formatCertCodesWithLabels(req)})
                            </span>
                          </p>
                        ) : null}
                        {w ? (
                          <p className="mt-0.5 text-xs leading-snug">
                            <span className="font-semibold text-gray-500 dark:text-gray-400">Worker certs: </span>
                            <span className="text-gray-900 dark:text-gray-100">
                              {w.certifications?.filter(Boolean).length
                                ? (w.certifications ?? []).filter(Boolean).join(", ")
                                : "none on file"}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Assign a worker to validate certifications.</p>
                        )}
                        {certRows.map((c) => (
                          <p
                            key={`${s.id}-${c.code}-${c.label}`}
                            className={`mt-1 text-xs font-medium leading-snug ${
                              c.severity === "critical" ? "text-red-800 dark:text-red-300" : "text-amber-900 dark:text-amber-300"
                            }`}
                          >
                            {c.label}
                          </p>
                        ))}
                        {otherRows.length ? (
                          <div className="mt-2 border-t border-gray-200/80 pt-1.5 dark:border-[#1F2937]/80">
                            {otherRows.map((c) => (
                              <p
                                key={`${s.id}-${c.code}-${c.label}-o`}
                                className={`text-xs leading-snug ${
                                  c.severity === "critical"
                                    ? "font-medium text-red-800 dark:text-red-300"
                                    : "text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                {c.label}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {s.uiFlags?.isNew ? (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
                            New
                          </span>
                        ) : null}
                        {s.uiFlags?.isUpdated ? (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
                            Updated
                          </span>
                        ) : null}
                        <div className="flex items-center gap-1">
                          {certFlag ? (
                            <span title={hoverTip} className="inline-flex">
                              <Award className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" strokeWidth={2} aria-hidden />
                            </span>
                          ) : null}
                          {sev ? (
                            <span
                              title={hoverTip}
                              className={`h-2.5 w-2.5 rounded-full ${sev === "critical" ? "bg-red-500" : "bg-amber-400"}`}
                              aria-label={hoverTip}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <p className="border-t border-gray-200 px-4 py-3 text-[11px] text-gray-500 dark:border-[#1F2937] dark:text-gray-400 sm:px-5">
            Drag to a day in the month view to move or reschedule. Hold{" "}
            <kbd className="rounded bg-gray-100 px-1 dark:bg-[#0F172A]">Shift</kbd>{" "}
            while dragging to duplicate. Drop on the bottom-right trash target to delete.
          </p>
        </div>

        <aside
          className={`flex flex-col gap-3 bg-gray-50/80 px-4 py-4 dark:bg-[#0B0F14]/50 sm:px-5 lg:py-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
        >
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
            <p className="flex items-center gap-2 font-headline text-sm font-bold text-gray-900 dark:text-white">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
              Conflicts summary
            </p>
            {conflictSummary.withIssues === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No issues flagged for this day.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">
                  <span className="font-semibold tabular-nums">{conflictSummary.withIssues}</span> shift
                  {conflictSummary.withIssues === 1 ? "" : "s"} with notes
                  {conflictSummary.shiftsWithCritical > 0 ? (
                    <span className="text-red-700 dark:text-red-400">
                      {" "}
                      ·{" "}
                      <span className="font-semibold tabular-nums">{conflictSummary.shiftsWithCritical}</span> with
                      critical flags
                    </span>
                  ) : null}
                  .
                </p>
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs text-gray-500 marker:text-gray-400 dark:text-gray-400 dark:marker:text-gray-500">
                  {conflictSummary.labels.map((lb) => (
                    <li key={lb}>{lb}</li>
                  ))}
                  {conflictSummary.totalLabels > conflictSummary.labels.length ? (
                    <li className="list-none pl-0 text-[11px]">+ more in shift details</li>
                  ) : null}
                </ul>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
