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
  shiftDragEnabled?: boolean;
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
  shiftDragEnabled = true,
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
    <div className="overflow-hidden rounded-md border border-pulseShell-border bg-pulseShell-surface shadow-[var(--pulse-shell-shadow)]">
      <div
        className={`flex flex-col gap-4 border-b border-pulseShell-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <button
            type="button"
            className="inline-flex w-fit items-center gap-2 rounded-md border border-pulseShell-border bg-pulseShell-elevated px-3 py-2 text-sm font-semibold text-ds-foreground shadow-sm hover:bg-pulseShell-surface"
            onClick={onClose}
            aria-label="Back to calendar"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Calendar
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Day workspace</p>
            <h2 className="font-headline text-xl font-bold tracking-tight text-ds-foreground">{label}</h2>
            <p className="mt-1 text-sm text-ds-muted">
              {sorted.length} shift{sorted.length === 1 ? "" : "s"} · edit, drag to reschedule, or drop on trash to
              delete.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            className="ds-btn-solid-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
            onClick={() => onAddForDate(date)}
            aria-label="Add shift"
          >
            <Plus className="h-4 w-4" />
            Add shift
          </button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-h-[16rem] border-b border-pulseShell-border lg:border-b-0 lg:border-r">
          <div className="max-h-[min(70vh,640px)] space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
            {sorted.length === 0 ? (
              <p className="py-12 text-center text-sm text-ds-muted">No shifts this day.</p>
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
                  : "border border-pulseShell-border bg-pulseShell-elevated text-ds-foreground";
                const openCls = isOpen
                  ? "ring-2 ring-dashed ring-ds-success/45 ring-offset-2 ring-offset-pulse-shell-cell dark:ring-offset-pulse-shell-cell"
                  : "";
                const chipLocked = scheduleDragLock && dragSession !== null && dragSession.shiftId !== s.id;
                const canDrag =
                  shiftDragEnabled && (!scheduleDragLock || dragSession?.shiftId === s.id);

                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    draggable={canDrag}
                    className={`w-full rounded-md px-3 py-3 text-left text-sm shadow-sm transition-opacity hover:brightness-[0.98] ${
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
                      if (!shiftDragEnabled) {
                        e.preventDefault();
                        return;
                      }
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
                            <span className="rounded bg-[color-mix(in_srgb,var(--ds-success)_18%,var(--ds-surface-elevated))] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ds-success">
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
                            <span className="font-semibold text-ds-muted">Required: </span>
                            <span className="text-ds-foreground">{formatCertCodesShort(req)}</span>
                            <span className="text-ds-muted">
                              {" "}
                              ({acceptAny ? "any one" : "all"}: {formatCertCodesWithLabels(req)})
                            </span>
                          </p>
                        ) : null}
                        {w ? (
                          <p className="mt-0.5 text-xs leading-snug">
                            <span className="font-semibold text-ds-muted">Worker certs: </span>
                            <span className="text-ds-foreground">
                              {w.certifications?.filter(Boolean).length
                                ? (w.certifications ?? []).filter(Boolean).join(", ")
                                : "none on file"}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-ds-muted">Assign a worker to validate certifications.</p>
                        )}
                        {certRows.map((c) => (
                          <p
                            key={`${s.id}-${c.code}-${c.label}`}
                            className={`mt-1 text-xs font-medium leading-snug ${
                              c.severity === "critical" ? "text-ds-danger" : "text-ds-warning"
                            }`}
                          >
                            {c.label}
                          </p>
                        ))}
                        {otherRows.length ? (
                          <div className="mt-2 border-t border-pulseShell-border/80 pt-1.5">
                            {otherRows.map((c) => (
                              <p
                                key={`${s.id}-${c.code}-${c.label}-o`}
                                className={`text-xs leading-snug ${
                                  c.severity === "critical" ? "font-medium text-ds-danger" : "text-ds-muted"
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
                          <span className="rounded bg-[color-mix(in_srgb,var(--ds-success)_16%,var(--ds-surface-primary))] px-1.5 py-0.5 text-[10px] font-bold text-ds-success">
                            New
                          </span>
                        ) : null}
                        {s.uiFlags?.isUpdated ? (
                          <span className="rounded bg-[color-mix(in_srgb,var(--ds-warning)_16%,var(--ds-surface-primary))] px-1.5 py-0.5 text-[10px] font-bold text-ds-warning">
                            Updated
                          </span>
                        ) : null}
                        <div className="flex items-center gap-1">
                          {certFlag ? (
                            <span title={hoverTip} className="inline-flex">
                              <Award className="h-3.5 w-3.5 text-ds-muted" strokeWidth={2} aria-hidden />
                            </span>
                          ) : null}
                          {sev ? (
                            <span
                              title={hoverTip}
                              className={`h-2.5 w-2.5 rounded-full ${sev === "critical" ? "bg-ds-danger" : "bg-ds-warning"}`}
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
          <p className="border-t border-pulseShell-border px-4 py-3 text-[11px] text-ds-muted sm:px-5">
            Drag to a day in the month view to move or reschedule. Hold{" "}
            <kbd className="rounded border border-pulseShell-border bg-pulseShell-kbd px-1 dark:border-pulseShell-border">Shift</kbd>{" "}
            while dragging to duplicate. Drop on the bottom-right trash target to delete.
          </p>
        </div>

        <aside
          className={`flex flex-col gap-3 bg-pulseShell-header-row/90 px-4 py-4 dark:bg-pulseShell-elevated/20 sm:px-5 lg:py-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
        >
          <div className="rounded-md border border-pulseShell-border bg-pulseShell-surface p-4 shadow-[var(--pulse-shell-shadow)]">
            <p className="flex items-center gap-2 font-headline text-sm font-bold text-ds-foreground">
              <AlertTriangle className="h-4 w-4 text-ds-warning" aria-hidden />
              Conflicts summary
            </p>
            {conflictSummary.withIssues === 0 ? (
              <p className="mt-2 text-sm text-ds-muted">No issues flagged for this day.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-ds-foreground">
                  <span className="font-semibold tabular-nums">{conflictSummary.withIssues}</span> shift
                  {conflictSummary.withIssues === 1 ? "" : "s"} with notes
                  {conflictSummary.shiftsWithCritical > 0 ? (
                    <span className="text-ds-danger">
                      {" "}
                      ·{" "}
                      <span className="font-semibold tabular-nums">{conflictSummary.shiftsWithCritical}</span> with
                      critical flags
                    </span>
                  ) : null}
                  .
                </p>
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs text-ds-muted marker:text-ds-muted">
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
