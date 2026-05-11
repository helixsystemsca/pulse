"use client";

import { AlertTriangle, ArrowLeft, Plus, ClipboardList, Trash2, ListChecks } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { RoutineAssignModal } from "@/components/schedule/RoutineAssignModal";
import {
  formatCertCodesShort,
  formatCertCodesWithLabels,
  scheduleShiftHoverSummary,
} from "@/lib/schedule/certifications";
import { getShiftConflicts, worstConflictSeverity } from "@/lib/schedule/conflicts";
import { workerHighlightOverlayClass } from "@/lib/schedule/drag-highlight-classes";
import {
  attachShiftDragPreview,
  readWorkerDragPayload,
  scheduleDayWorkerDropZoneAccepts,
  setShiftDragData,
} from "@/lib/schedule/drag";
import { flushSync } from "react-dom";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { evaluateWorkerDrop, type WorkerDayHighlight } from "@/lib/schedule/worker-drag-highlights";
import { formatTimeRange } from "@/lib/schedule/time-format";
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
import type { ScheduleAssignment } from "@/lib/schedule/assignments";
import {
  createScheduleAssignment,
  deleteScheduleAssignment,
  fetchScheduleAssignments,
  patchScheduleAssignment,
} from "@/lib/schedule/assignments";
import { shiftDisplayCode } from "@/lib/schedule/compact-day-shifts";
import { buildShiftCodeMapForDay } from "@/lib/schedule/shift-codes";
import { shiftCodeToneClassForRowBadge } from "@/lib/schedule/scheduleWorkerPanelSort";
import { ScheduleShiftCertChips } from "./ScheduleShiftCertChips";

type Props = {
  date: string;
  onClose: () => void;
  shifts: Shift[];
  /** Full schedule used for worker-drop validation (weekly hours, etc.). */
  contextShifts: Shift[];
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
  dragSession: ScheduleDragSession | null;
  calendarDropsDisabled?: boolean;
  shiftDragEnabled?: boolean;
  workerDayHighlight?: WorkerDayHighlight | null;
  workerDropPlacementWindow?: { start: string; end: string } | null;
  onWorkerDropRejected?: (message: string) => void;
  onWorkerDrop?: (workerId: string) => void;
  onShiftDragSessionStart: (payload: ScheduleDragSession) => void;
  onShiftDragSessionEnd: () => void;
  /** Projects that cover this calendar day (coloured top strip, same tints as month view). */
  dayProjectBar?: { id: string; name: string; tintClass: string }[] | null;
};

/**
 * Full-panel single-day workspace: same shift visuals and conflict hints as the month grid; chips stay draggable (trash + calendar drops use the global session).
 */
export function ScheduleDayView({
  date,
  onClose,
  shifts,
  contextShifts,
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
  calendarDropsDisabled = false,
  shiftDragEnabled = true,
  workerDayHighlight = null,
  workerDropPlacementWindow = null,
  onWorkerDropRejected,
  onWorkerDrop,
  onShiftDragSessionStart,
  onShiftDragSessionEnd,
  dayProjectBar = null,
}: Props) {
  const [shake, setShake] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [assignShiftType, setAssignShiftType] = useState<string>("night");
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [newArea, setNewArea] = useState("");
  const [newWorkerId, setNewWorkerId] = useState<string>("");
  const [newNotes, setNewNotes] = useState("");

  const [workQueue, setWorkQueue] = useState<{
    work_requests: Array<{ id: string; title: string; priority: string; status: string }>;
    overdue_pms: Array<{ id: string; name: string; days_overdue: number }>;
  } | null>(null);
  const [loadingWQ, setLoadingWQ] = useState(false);
  const [assignRoutineOpen, setAssignRoutineOpen] = useState(false);

  const triggerShake = () => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShake(true);
    shakeTimer.current = setTimeout(() => {
      setShake(false);
      shakeTimer.current = null;
    }, 420);
  };

  const typeMap = useMemo(() => new Map(shiftTypes.map((t) => [t.key, t])), [shiftTypes]);
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z.label])), [zones]);
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r.label])), [roles]);
  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);

  const sorted = useMemo(() => [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime)), [shifts]);
  const codeMap = useMemo(() => buildShiftCodeMapForDay(dayShiftsAll), [dayShiftsAll]);

  const assignShiftTypeDefault = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of shifts) counts[s.shiftType] = (counts[s.shiftType] ?? 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? "night";
  }, [shifts]);

  useEffect(() => {
    setAssignShiftType(assignShiftTypeDefault);
  }, [assignShiftTypeDefault, date]);

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

  useEffect(() => {
    let cancelled = false;
    setAssignLoading(true);
    setAssignError(null);
    void (async () => {
      try {
        const from = `${date}T00:00:00.000Z`;
        const to = `${date}T23:59:59.999Z`;
        const rows = await fetchScheduleAssignments({ from, to, shift_type: assignShiftType });
        if (cancelled) return;
        setAssignments(rows.filter((r) => r.date === date));
      } catch {
        if (!cancelled) setAssignError("Could not load assignments.");
      } finally {
        if (!cancelled) setAssignLoading(false);
      }
    })();

    const dayShift = shifts.find((s) => s.shiftKind !== "project_task");
    if (dayShift) {
      setLoadingWQ(true);
      apiFetch<typeof workQueue>(`/api/v1/pulse/schedule/shifts/${dayShift.id}/work-queue`)
        .then((data) => {
          if (!cancelled) setWorkQueue(data);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingWQ(false);
        });
    } else {
      setWorkQueue(null);
    }
    return () => {
      cancelled = true;
    };
  }, [date, assignShiftType, shifts]);

  return (
    <div className="overflow-hidden rounded-md border border-pulseShell-border bg-pulseShell-surface shadow-[var(--pulse-shell-shadow)]">
      <div
        className={`flex flex-col gap-4 border-b border-pulseShell-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <button
            type="button"
            className="inline-flex w-fit items-center gap-2 rounded-md border border-pulseShell-border bg-pulseShell-elevated px-3 py-2 text-sm font-semibold text-ds-foreground shadow-sm hover:bg-ds-interactive-hover"
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
            className={cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center gap-2 px-4 py-2.5 text-sm")}
            onClick={() => onAddForDate(date)}
            aria-label="Add shift"
          >
            <Plus className="h-4 w-4" />
            Add shift
          </button>
        </div>
      </div>
      {dayProjectBar && dayProjectBar.length > 0 ? (
        <div className="flex h-1.5 w-full overflow-hidden border-b border-pulseShell-border" aria-hidden>
          {dayProjectBar.map((p) => (
            <div
              key={p.id}
              className={`min-w-0 flex-1 ${p.tintClass}`}
              title={p.name}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          className={`relative min-h-[16rem] border-b border-pulseShell-border lg:border-b-0 lg:border-r ${shake ? "schedule-cell-shake" : ""}`}
          title={dragSession?.kind === "worker" && workerDayHighlight?.tooltip ? workerDayHighlight.tooltip : undefined}
          onDragOver={(e) => {
            if (calendarDropsDisabled) return;
            if (!scheduleDayWorkerDropZoneAccepts(e, dragSession)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (calendarDropsDisabled || !onWorkerDrop) return;
            const wp = readWorkerDragPayload(e.dataTransfer);
            if (!wp) return;
            const w = workers.find((x) => x.id === wp.workerId);
            if (w) {
              const ev = evaluateWorkerDrop(w, date, contextShifts, settings, timeOffBlocks, workerDropPlacementWindow);
              if (!ev.ok) {
                if (ev.needsManagerOverride) {
                  onWorkerDrop(wp.workerId);
                  return;
                }
                triggerShake();
                onWorkerDropRejected?.(ev.tooltip ?? "Cannot schedule this placement.");
                return;
              }
            }
            onWorkerDrop(wp.workerId);
          }}
        >
          {dragSession?.kind === "worker" && workerDayHighlight ? (
            <div
              className={`pointer-events-none absolute inset-0 z-0 ${workerHighlightOverlayClass(workerDayHighlight.tone)}`}
              aria-hidden
            />
          ) : null}
          <div className="relative z-[1] max-h-[min(70vh,640px)] space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
            {sorted.length === 0 ? (
              <p className="py-12 text-center text-sm text-ds-muted">No shifts this day.</p>
            ) : (
              sorted.map((s) => {
                const st = typeMap.get(s.shiftType);
                const w = s.workerId ? workerMap.get(s.workerId) : null;
                const isOpen = !s.workerId;
                const rawName =
                  s.shiftKind === "project_task" && s.taskTitle ? s.taskTitle : (w?.name ?? "Open shift");
                const name =
                  s.eventType === "vacation" ? "Vacation" : s.eventType === "sick" ? "Sick leave" : rawName;
                const zone = zoneMap.get(s.zoneId) ?? "—";
                const roleLb = roleMap.get(s.role) ?? s.role;
                const conflicts = getShiftConflicts(s, dayShiftsAll, workers, settings, timeOffBlocks, zones);
                const sev = worstConflictSeverity(conflicts);
                const hoverTip = scheduleShiftHoverSummary(s, w, conflicts);
                const shiftCode = shiftDisplayCode(s, codeMap);
                const shiftCodeBadgeTone = shiftCodeToneClassForRowBadge(shiftCode);
                const certRows = conflicts.filter((c) => c.type === "certification");
                const otherRows = conflicts.filter((c) => c.type !== "certification");
                const req = s.required_certifications?.filter(Boolean) ?? [];
                const acceptAny = s.accepts_any_certification === true;
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
                  ? "ring-2 ring-dashed ring-ds-success/45 ring-offset-2 ring-offset-pulse-shell-cell dark:ring-offset-pulse-shell-cell"
                  : "";
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
                    title={sev ? hoverTip : undefined}
                    className={`w-full rounded-md px-3 py-3 text-left text-sm shadow-sm transition-opacity hover:brightness-[0.98] ${
                      s.autoGenerated ? "opacity-[0.92]" : ""
                    } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${
                      chipLocked ? "pointer-events-none" : ""
                    } ${chipBaseCls} ${openCls}`}
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
                      setShiftDragData(e.dataTransfer, {
                        shiftId: s.id,
                        duplicate: dup,
                      });
                      attachShiftDragPreview(e, dup);
                      flushSync(() =>
                        onShiftDragSessionStart({ kind: "shift", shiftId: s.id, duplicate: dup }),
                      );
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
                        {s.autoGenerated ? (
                          <span className="rounded bg-pulseShell-elevated px-1.5 py-0.5 text-[10px] font-bold text-ds-muted">
                            Auto
                          </span>
                        ) : null}
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
                        <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1">
                          {req.length ? <ScheduleShiftCertChips shift={s} size="day" /> : null}
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-extrabold leading-none uppercase tracking-wide",
                              ptoCls
                                ? "border border-ds-border bg-pulseShell-elevated/60 text-ds-foreground"
                                : shiftCodeBadgeTone ??
                                    (st
                                      ? `${st.bg} ${st.border} ${st.text} border`
                                      : "border border-pulseShell-border bg-pulseShell-elevated text-ds-foreground"),
                            )}
                          >
                            {shiftCode}
                          </span>
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

          <div className="rounded-md border border-pulseShell-border bg-pulseShell-surface p-4 shadow-[var(--pulse-shell-shadow)]">
              <div>
                <p className="flex items-center gap-2 font-headline text-sm font-bold text-ds-foreground">
                  <ClipboardList className="h-4 w-4 text-ds-muted" aria-hidden />
                  Assignments
                </p>
                <p className="mt-0.5 text-xs text-ds-muted">Areas and notes for this day (per shift type).</p>
              </div>

              <div className="mt-3">
                <label htmlFor="schedule-assign-shift-type" className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
                  Shift
                </label>
                <select
                  id="schedule-assign-shift-type"
                  className="mt-1.5 w-full rounded-md border border-pulseShell-border bg-pulseShell-elevated px-3 py-2 text-sm font-semibold text-ds-foreground"
                  value={assignShiftType}
                  onChange={(e) => setAssignShiftType(e.target.value)}
                >
                  {shiftTypes.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label || t.key}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-ds-muted">Pick day, afternoon, or night before adding checklist rows below.</p>
              </div>

              <div className="mt-3 rounded-md border border-pulseShell-border bg-pulseShell-elevated p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Create</p>
                <div className="mt-2 space-y-2">
                  <input
                    className="w-full rounded-md border border-pulseShell-border bg-pulseShell-surface px-3 py-2 text-sm text-ds-foreground"
                    placeholder="Area (Pool Deck, Weight Room, Change Rooms, B Side, A Side)"
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                  />
                  <select
                    className="w-full rounded-md border border-pulseShell-border bg-pulseShell-surface px-3 py-2 text-sm text-ds-foreground"
                    value={newWorkerId}
                    onChange={(e) => setNewWorkerId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {workers
                      .filter((w) => w.active)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                  <textarea
                    className="w-full rounded-md border border-pulseShell-border bg-pulseShell-surface px-3 py-2 text-sm text-ds-foreground"
                    placeholder="Notes (optional)"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                  />
                  <button
                    type="button"
                    className={cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm")}
                    disabled={assignLoading || !newArea.trim()}
                    onClick={() => {
                      if (!newArea.trim()) return;
                      setAssignLoading(true);
                      void (async () => {
                        try {
                          const created = await createScheduleAssignment({
                            date,
                            shift_type: assignShiftType,
                            area: newArea.trim(),
                            assigned_user_id: newWorkerId || null,
                            notes: newNotes.trim() || null,
                          });
                          setAssignments((prev) => [...prev, created].sort((a, b) => a.area.localeCompare(b.area)));
                          setNewArea("");
                          setNewWorkerId("");
                          setNewNotes("");
                        } catch {
                          window.alert("Could not create assignment.");
                        } finally {
                          setAssignLoading(false);
                        }
                      })();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add assignment
                  </button>
                </div>
              </div>

              {assignError ? (
                <p className="mt-3 rounded-md border border-amber-200/90 bg-amber-50/60 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100">
                  {assignError}
                </p>
              ) : null}

              <div className="mt-3 space-y-2">
                {assignLoading ? <p className="text-sm text-ds-muted">Loading…</p> : null}
                {!assignLoading && assignments.length === 0 ? (
                  <p className="text-sm text-ds-muted">No assignments yet.</p>
                ) : null}
                {assignments.map((a) => (
                  <div key={a.id} className="rounded-md border border-pulseShell-border bg-pulseShell-elevated p-3">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-md border border-pulseShell-border bg-pulseShell-surface px-3 py-2 text-sm text-ds-foreground"
                        value={a.area}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, area: v } : x)));
                        }}
                        onBlur={() => {
                          void patchScheduleAssignment(a.id, { area: a.area.trim() || a.area }).catch(() =>
                            window.alert("Could not save area."),
                          );
                        }}
                      />
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-pulseShell-border px-2.5 py-2 text-xs font-semibold text-ds-muted hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          if (typeof window !== "undefined" && !window.confirm("Delete this assignment?")) return;
                          void deleteScheduleAssignment(a.id)
                            .then(() => setAssignments((prev) => prev.filter((x) => x.id !== a.id)))
                            .catch(() => window.alert("Could not delete assignment."));
                        }}
                        aria-label="Delete assignment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <select
                      className="mt-2 w-full rounded-md border border-pulseShell-border bg-pulseShell-surface px-3 py-2 text-sm text-ds-foreground"
                      value={a.assigned_user_id ?? ""}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        setAssignments((prev) =>
                          prev.map((x) => (x.id === a.id ? { ...x, assigned_user_id: v } : x)),
                        );
                        void patchScheduleAssignment(a.id, { assigned_user_id: v }).catch(() =>
                          window.alert("Could not save worker."),
                        );
                      }}
                    >
                      <option value="">Unassigned</option>
                      {workers
                        .filter((w) => w.active)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                    </select>
                    <textarea
                      className="mt-2 w-full rounded-md border border-pulseShell-border bg-pulseShell-surface px-3 py-2 text-sm text-ds-foreground"
                      value={a.notes ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, notes: v } : x)));
                      }}
                      onBlur={() => {
                        void patchScheduleAssignment(a.id, { notes: (a.notes ?? "").trim() || null }).catch(() =>
                          window.alert("Could not save notes."),
                        );
                      }}
                      placeholder="Notes"
                    />
                  </div>
                ))}
              </div>

              {loadingWQ ? <p className="mt-3 text-sm text-ds-muted">Loading work queue…</p> : null}
              {workQueue &&
              (workQueue.work_requests.length > 0 || workQueue.overdue_pms.length > 0) ? (
                <div className="mt-4 space-y-3 border-t border-ds-border pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Work queue for this shift</p>
                    {(() => {
                      const dayShift = shifts.find((s) => s.shiftKind !== "project_task");
                      if (!dayShift) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-md border border-ds-border bg-ds-secondary px-3 py-1.5 text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
                            onClick={() => setAssignRoutineOpen(true)}
                          >
                            <ListChecks className="h-4 w-4" aria-hidden />
                            Assign routine
                          </button>
                          <Link
                            href={`/standards/routines/run?shift_id=${encodeURIComponent(dayShift.id)}`}
                            className="inline-flex items-center gap-2 rounded-md border border-ds-border bg-ds-secondary px-3 py-1.5 text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
                          >
                            Run routine
                          </Link>
                        </div>
                      );
                    })()}
                  </div>

                  {workQueue.overdue_pms.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-ds-muted">Overdue PMs</p>
                      {workQueue.overdue_pms.map((pm) => (
                        <div
                          key={pm.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-ds-border bg-ds-primary px-3 py-2"
                        >
                          <span className="truncate text-xs text-ds-foreground">{pm.name}</span>
                          <span className="shrink-0 text-[10px] font-bold text-red-600 dark:text-red-400">
                            {pm.days_overdue}d overdue
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {workQueue.work_requests.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-ds-muted">Open work requests</p>
                      {workQueue.work_requests.map((wr) => (
                        <div
                          key={wr.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-ds-border bg-ds-primary px-3 py-2"
                        >
                          <span className="truncate text-xs text-ds-foreground">{wr.title}</span>
                          <span
                            className={`shrink-0 text-[10px] font-bold uppercase ${
                              wr.priority === "critical"
                                ? "text-red-600 dark:text-red-400"
                                : wr.priority === "high"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-ds-muted"
                            }`}
                          >
                            {wr.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
        </aside>
      </div>
      <RoutineAssignModal
        open={assignRoutineOpen}
        onClose={() => setAssignRoutineOpen(false)}
        shiftDate={date}
        workers={workers}
        shiftTypes={shiftTypes}
        shiftsOnDay={dayShiftsAll}
        initialShiftType={assignShiftType}
      />
    </div>
  );
}
