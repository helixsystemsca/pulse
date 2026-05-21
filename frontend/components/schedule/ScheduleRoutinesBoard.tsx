"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { workerHighlightOverlayClass } from "@/lib/schedule/drag-highlight-classes";
import {
  attachRoutineDragPreview,
  readRoutineDragPayload,
  routineDropZoneAccepts,
  setRoutineDragData,
} from "@/lib/schedule/routine-drag";
import {
  buildRoutineEligibilityByRowKey,
  routineItemsForShiftBand,
  type RoutineTrainingContext,
} from "@/lib/schedule/routine-eligibility";
import type { Shift, ShiftTypeConfig, Worker, Zone } from "@/lib/schedule/types";
import {
  createRoutineAssignment,
  getRoutine,
  listRoutines,
  type RoutineDetail,
  type RoutineRow,
} from "@/lib/routinesService";
import {
  fetchTrainingMatrix,
  mapApiAssignments,
  mapApiPrograms,
} from "@/lib/trainingApi";
import { parseLocalDate, formatLocalDate } from "@/lib/schedule/calendar";

type ScheduledRow = {
  rowKey: string;
  worker: Worker;
  shift: Shift;
};

type LocalAssignment = {
  routineId: string;
  routineName: string;
  assignmentId?: string;
};

type Props = {
  focusDate: string;
  onFocusDateChange: (date: string) => void;
  workers: Worker[];
  shifts: Shift[];
  zones: Zone[];
  shiftTypes: ShiftTypeConfig[];
};

function shiftTypeLabel(shiftTypes: ShiftTypeConfig[], key: string): string {
  return shiftTypes.find((t) => t.key === key)?.label ?? key;
}

export function ScheduleRoutinesBoard({
  focusDate,
  onFocusDateChange,
  workers,
  shifts,
  zones,
  shiftTypes,
}: Props) {
  const [routines, setRoutines] = useState<RoutineRow[] | null>(null);
  const [routineDetails, setRoutineDetails] = useState<Record<string, RoutineDetail>>({});
  const [training, setTraining] = useState<RoutineTrainingContext | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [draggingRoutineId, setDraggingRoutineId] = useState<string | null>(null);
  const [hoverRowKey, setHoverRowKey] = useState<string | null>(null);
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [assignedByRow, setAssignedByRow] = useState<Record<string, LocalAssignment[]>>({});

  const zoneLabel = useMemo(() => {
    const m = new Map(zones.map((z) => [z.id, z.label]));
    return (zoneId: string) => m.get(zoneId) ?? zoneId;
  }, [zones]);

  const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);

  const scheduledRows = useMemo((): ScheduledRow[] => {
    const dayShifts = shifts
      .filter(
        (s) =>
          s.date === focusDate &&
          s.shiftKind !== "project_task" &&
          s.eventType === "work" &&
          s.workerId &&
          workerById.has(s.workerId),
      )
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.workerId!.localeCompare(b.workerId!));

    return dayShifts.map((shift) => {
      const worker = workerById.get(shift.workerId!)!;
      return { rowKey: `${worker.id}:${shift.id}`, worker, shift };
    });
  }, [shifts, focusDate, workerById]);

  const draggingRoutine = draggingRoutineId ? routineDetails[draggingRoutineId] ?? null : null;

  const eligibilityByRow = useMemo(() => {
    const ctx: RoutineTrainingContext = training ?? { programs: [], assignments: [], acknowledgements: [] };
    return buildRoutineEligibilityByRowKey(scheduledRows, draggingRoutine, ctx);
  }, [scheduledRows, draggingRoutine, training]);

  useEffect(() => {
    let cancelled = false;
    setLoadErr(null);
    void (async () => {
      try {
        const [list, matrix] = await Promise.all([
          listRoutines(),
          fetchTrainingMatrix().catch((e) => {
            const st = (e as { status?: number })?.status;
            if (st === 403 || st === 401) return null;
            throw e;
          }),
        ]);
        if (cancelled) return;
        setRoutines(list);
        if (matrix) {
          setTraining({
            programs: mapApiPrograms(matrix.programs),
            assignments: mapApiAssignments(matrix.assignments),
            acknowledgements: [],
          });
        } else {
          setTraining({ programs: [], assignments: [], acknowledgements: [] });
        }
      } catch (e) {
        if (!cancelled) {
          const { message } = parseClientApiError(e);
          setLoadErr(message || "Could not load routines data.");
          setRoutines([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const ensureRoutineDetail = useCallback(async (routineId: string): Promise<RoutineDetail | null> => {
    const cached = routineDetails[routineId];
    if (cached) return cached;
    try {
      const d = await getRoutine(routineId);
      setRoutineDetails((prev) => ({ ...prev, [routineId]: d }));
      return d;
    } catch {
      return null;
    }
  }, [routineDetails]);

  async function onRoutineDragStart(e: React.DragEvent, routine: RoutineRow) {
    setRoutineDragData(e.dataTransfer, { routineId: routine.id });
    attachRoutineDragPreview(e, routine.name);
    void ensureRoutineDetail(routine.id);
    flushSync(() => setDraggingRoutineId(routine.id));
  }

  function onRoutineDragEnd() {
    setDraggingRoutineId(null);
    setHoverRowKey(null);
  }

  async function assignRoutineToRow(row: ScheduledRow, routineId: string) {
    const detail = routineDetails[routineId] ?? (await ensureRoutineDetail(routineId));
    if (!detail) {
      setLoadErr("Could not load routine details.");
      return;
    }
    const ctx = training ?? { programs: [], assignments: [], acknowledgements: [] };
    const ev = buildRoutineEligibilityByRowKey([row], detail, ctx)[row.rowKey];
    if (!ev?.eligible) return;

    const items = routineItemsForShiftBand(detail.items, row.shift.shiftType);
    setSavingRowKey(row.rowKey);
    setLoadErr(null);
    try {
      const res = await createRoutineAssignment({
        routine_id: routineId,
        primary_user_id: row.worker.id,
        date: focusDate,
        shift_id: row.shift.id,
        item_assignments: items.map((it) => ({
          routine_item_id: it.id,
          assigned_to_user_id: row.worker.id,
          reason: "schedule_board",
        })),
      });
      setAssignedByRow((prev) => ({
        ...prev,
        [row.rowKey]: [
          ...(prev[row.rowKey] ?? []),
          { routineId, routineName: detail.name, assignmentId: res.id },
        ],
      }));
      setToast(`Assigned “${detail.name}” to ${row.worker.name}.`);
    } catch (err) {
      const { message } = parseClientApiError(err);
      setLoadErr(message || "Could not save assignment.");
    } finally {
      setSavingRowKey(null);
    }
  }

  function nudgeDate(delta: number) {
    const d = parseLocalDate(focusDate);
    d.setDate(d.getDate() + delta);
    onFocusDateChange(formatLocalDate(d));
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[250] max-w-md -translate-x-1/2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg dark:border-emerald-500/35 dark:bg-emerald-950/95 dark:text-emerald-100"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pulseShell-border/80 bg-pulseShell-surface/60 px-3 py-2 dark:border-slate-700/80 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-ds-border p-1.5 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
            onClick={() => nudgeDate(-1)}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-sm font-semibold text-ds-foreground">{focusDate}</p>
            <p className="text-xs text-ds-muted">Scheduled workers for this day</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-ds-border p-1.5 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
            onClick={() => nudgeDate(1)}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {draggingRoutineId ? (
          <p className="text-xs text-ds-muted">
            Dragging{" "}
            <span className="font-semibold text-ds-foreground">
              {routines?.find((r) => r.id === draggingRoutineId)?.name ?? "routine"}
            </span>
            — rows highlight{" "}
            <span className="text-[var(--ds-success)]">green</span> when eligible and{" "}
            <span className="text-[var(--ds-danger)]">red</span> when not.
          </p>
        ) : (
          <p className="text-xs text-ds-muted">Drag a routine onto a worker row to assign.</p>
        )}
      </div>

      {loadErr ? (
        <div className="rounded-xl border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-danger">
          {loadErr}
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <aside className="rounded-xl border border-pulseShell-border/90 bg-pulseShell-surface/95 p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/80">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[var(--ds-accent)]" aria-hidden />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Routine matrix</p>
              <p className="text-[11px] text-ds-muted">Drag onto a worker below</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {routines === null ? (
              <p className="col-span-2 text-sm text-ds-muted">Loading routines…</p>
            ) : routines.length === 0 ? (
              <p className="col-span-2 text-sm text-ds-muted">No routines defined yet.</p>
            ) : (
              routines.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  draggable
                  onDragStart={(e) => void onRoutineDragStart(e, r)}
                  onDragEnd={onRoutineDragEnd}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-left text-xs font-semibold transition-colors",
                    "border-violet-200/90 bg-violet-50/90 text-violet-900 hover:bg-violet-100/90",
                    "dark:border-violet-500/35 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/60",
                    draggingRoutineId === r.id && "ring-2 ring-[var(--ds-accent)]",
                  )}
                  title={r.name}
                >
                  <span className="line-clamp-2">{r.name}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="min-w-0 overflow-x-auto rounded-xl border border-pulseShell-border/90 bg-pulseShell-surface/95 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/80">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ds-border text-left text-[10px] font-bold uppercase tracking-wider text-ds-muted">
                <th className="px-3 py-2">Worker</th>
                <th className="px-3 py-2">Shift</th>
                <th className="px-3 py-2">Facility</th>
                <th className="px-3 py-2">Assigned today</th>
              </tr>
            </thead>
            <tbody>
              {scheduledRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-ds-muted">
                    No workforce shifts with assigned workers on this date.
                  </td>
                </tr>
              ) : (
                scheduledRows.map((row) => {
                  const ev = eligibilityByRow[row.rowKey];
                  const highlight = draggingRoutineId ? ev?.tone : undefined;
                  const assigned = assignedByRow[row.rowKey] ?? [];
                  const isSaving = savingRowKey === row.rowKey;

                  return (
                    <tr
                      key={row.rowKey}
                      className={cn(
                        "relative border-b border-ds-border/80 transition-colors",
                        hoverRowKey === row.rowKey && ev?.eligible && "bg-ds-interactive-hover/40",
                      )}
                      onDragOver={(e) => {
                        if (!routineDropZoneAccepts(e, draggingRoutineId)) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = ev?.eligible ? "copy" : "none";
                        setHoverRowKey(row.rowKey);
                      }}
                      onDragLeave={() => {
                        if (hoverRowKey === row.rowKey) setHoverRowKey(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setHoverRowKey(null);
                        const payload = readRoutineDragPayload(e.dataTransfer);
                        const routineId = payload?.routineId ?? draggingRoutineId;
                        if (!routineId || !ev?.eligible) return;
                        void assignRoutineToRow(row, routineId);
                        onRoutineDragEnd();
                      }}
                    >
                      <td className="relative px-3 py-2.5 font-medium text-ds-foreground">
                        {highlight ? (
                          <span
                            className={cn(
                              "pointer-events-none absolute inset-0",
                              workerHighlightOverlayClass(highlight),
                            )}
                            aria-hidden
                          />
                        ) : null}
                        <span className="relative">{row.worker.name}</span>
                      </td>
                      <td className="relative px-3 py-2.5 text-ds-foreground">
                        <span className="relative">
                          {shiftTypeLabel(shiftTypes, row.shift.shiftType)} · {row.shift.startTime}–{row.shift.endTime}
                        </span>
                      </td>
                      <td className="relative px-3 py-2.5 text-ds-muted">
                        <span className="relative">{zoneLabel(row.shift.zoneId)}</span>
                      </td>
                      <td className="relative px-3 py-2.5">
                        <div className="relative flex min-h-[2rem] flex-wrap items-center gap-1">
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin text-ds-muted" aria-hidden />
                          ) : null}
                          {assigned.length === 0 && !isSaving ? (
                            <span className="text-xs text-ds-muted">Drop routine here</span>
                          ) : (
                            assigned.map((a) => (
                              <span
                                key={`${a.routineId}-${a.assignmentId ?? "local"}`}
                                className="rounded-md border border-violet-200/80 bg-violet-50/90 px-2 py-0.5 text-xs font-medium text-violet-900 dark:border-violet-500/30 dark:bg-violet-950/60 dark:text-violet-100"
                              >
                                {a.routineName}
                              </span>
                            ))
                          )}
                        </div>
                        {draggingRoutineId && ev?.tooltip ? (
                          <p className="relative mt-1 text-[10px] text-ds-muted" title={ev.tooltip}>
                            {ev.tone === "good" ? "Eligible" : ev.tone === "warning" ? "Caution" : "Not eligible"} —{" "}
                            {ev.tooltip}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
