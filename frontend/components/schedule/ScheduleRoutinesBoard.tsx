"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  ARENA_SHIFT_SECTION_LABELS,
  groupArenaRoutines,
} from "@/lib/schedule/arena-routine-groups";
import { isArenaRoutineName } from "@/lib/schedule/arena-routine-catalog";
import { ensureArenaRoutines } from "@/lib/schedule/ensure-arena-routines";
import { workerHighlightOverlayClass } from "@/lib/schedule/drag-highlight-classes";
import {
  OPERATIONAL_BADGE_REGISTRY,
  operationalBadgeChipLabel,
} from "@/lib/schedule/operational-scheduling-model";
import {
  attachRoutineDragPreview,
  readRoutineDragPayload,
  routineDropZoneAccepts,
  setRoutineDragData,
} from "@/lib/schedule/routine-drag";
import {
  readRoutineBadgeDragPayload,
  routineBadgeDropZoneAccepts,
  setRoutineBadgeDragData,
  type RoutineBadgeKind,
} from "@/lib/schedule/routine-badge-drag";
import { operationalBadgeClasses } from "@/lib/schedule/schedule-semantic-styles";
import {
  buildRoutineEligibilityByRowKey,
  routineItemsForShiftBand,
  type RoutineTrainingContext,
} from "@/lib/schedule/routine-eligibility";
import type { RoutineShiftBand } from "@/lib/routinesService";
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
import { isPulseApiShiftId } from "@/lib/schedule/pulse-bridge";
import { ScheduleRoutineExtraModal } from "@/components/schedule/ScheduleRoutineExtraModal";

type ScheduledRow = {
  rowKey: string;
  worker: Worker;
  shift: Shift;
};

type LocalAssignment = {
  routineId: string;
  routineName: string;
  assignmentId?: string;
  kind?: "routine" | "extra" | "grounds";
  extraNote?: string;
};

type Props = {
  focusDate: string;
  onFocusDateChange: (date: string) => void;
  workers: Worker[];
  shifts: Shift[];
  zones: Zone[];
  shiftTypes: ShiftTypeConfig[];
  onAddOperationalBadge?: (workerId: string, date: string, code: string) => void;
};

function shiftTypeLabel(shiftTypes: ShiftTypeConfig[], key: string): string {
  return shiftTypes.find((t) => t.key === key)?.label ?? key;
}

const SHIFT_BANDS: RoutineShiftBand[] = ["day", "afternoon", "night"];

function routineChipClass(band: RoutineShiftBand | null): string {
  if (band === "night") {
    return "border-indigo-300/90 bg-indigo-50/90 text-indigo-950 dark:border-indigo-500/35 dark:bg-indigo-950/50 dark:text-indigo-100";
  }
  if (band === "afternoon") {
    return "border-amber-300/90 bg-amber-50/90 text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/50 dark:text-amber-100";
  }
  if (band === "day") {
    return "border-sky-300/90 bg-sky-50/90 text-sky-950 dark:border-sky-500/35 dark:bg-sky-950/50 dark:text-sky-100";
  }
  return "border-violet-200/90 bg-violet-50/90 text-violet-900 dark:border-violet-500/35 dark:bg-violet-950/50 dark:text-violet-100";
}

export function ScheduleRoutinesBoard({
  focusDate,
  onFocusDateChange,
  workers,
  shifts,
  zones,
  shiftTypes,
  onAddOperationalBadge,
}: Props) {
  const [routines, setRoutines] = useState<RoutineRow[] | null>(null);
  const [routineDetails, setRoutineDetails] = useState<Record<string, RoutineDetail>>({});
  const [training, setTraining] = useState<RoutineTrainingContext | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [draggingRoutineId, setDraggingRoutineId] = useState<string | null>(null);
  const [draggingBadge, setDraggingBadge] = useState<RoutineBadgeKind | null>(null);
  const [hoverRowKey, setHoverRowKey] = useState<string | null>(null);
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [syncingArena, setSyncingArena] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [assignedByRow, setAssignedByRow] = useState<Record<string, LocalAssignment[]>>({});
  const [extraModalRow, setExtraModalRow] = useState<ScheduledRow | null>(null);

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

  const routineGroups = useMemo(
    () => groupArenaRoutines(routines ?? []),
    [routines],
  );

  const hasArenaCatalog = useMemo(
    () => (routines ?? []).some((r) => isArenaRoutineName(r.name)),
    [routines],
  );

  const draggingRoutine = draggingRoutineId ? routineDetails[draggingRoutineId] ?? null : null;

  const eligibilityByRow = useMemo(() => {
    const ctx: RoutineTrainingContext = training ?? { programs: [], assignments: [], acknowledgements: [] };
    return buildRoutineEligibilityByRowKey(scheduledRows, draggingRoutine, ctx);
  }, [scheduledRows, draggingRoutine, training]);

  const reloadRoutines = useCallback(async () => {
    const list = await listRoutines();
    setRoutines(list);
    return list;
  }, []);

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
    setDraggingBadge(null);
    setRoutineDragData(e.dataTransfer, { routineId: routine.id });
    attachRoutineDragPreview(e, routine.name);
    void ensureRoutineDetail(routine.id);
    flushSync(() => setDraggingRoutineId(routine.id));
  }

  function onRoutineDragEnd() {
    setDraggingRoutineId(null);
    setHoverRowKey(null);
  }

  function onBadgeDragStart(e: React.DragEvent, badgeKind: RoutineBadgeKind) {
    setDraggingRoutineId(null);
    const label = badgeKind === "EXTRA" ? "Extra" : "Grounds";
    setRoutineBadgeDragData(e.dataTransfer, { badgeKind });
    e.dataTransfer.setData("text/plain", label);
    flushSync(() => setDraggingBadge(badgeKind));
  }

  function onBadgeDragEnd() {
    setDraggingBadge(null);
    setHoverRowKey(null);
  }

  async function assignRoutineToRow(
    row: ScheduledRow,
    routineId: string,
    opts?: { extras?: Array<{ label: string }>; displayName?: string; kind?: LocalAssignment["kind"] },
  ) {
    if (!isPulseApiShiftId(row.shift.id)) {
      setLoadErr(
        "This shift is not saved on the server yet. Publish or save the schedule shift, then assign the routine again.",
      );
      return;
    }

    let detail: RoutineDetail | null = null;
    try {
      detail = await getRoutine(routineId);
      setRoutineDetails((prev) => ({ ...prev, [routineId]: detail! }));
    } catch (err) {
      const { message } = parseClientApiError(err);
      setLoadErr(message || "Could not load routine details.");
      return;
    }

    const ctx = training ?? { programs: [], assignments: [], acknowledgements: [] };
    const ev = buildRoutineEligibilityByRowKey([row], detail, ctx)[row.rowKey];
    if (!ev?.eligible) {
      setLoadErr(ev?.tooltip ?? "Cannot assign this routine to this worker.");
      return;
    }

    const items = routineItemsForShiftBand(detail.items, row.shift.shiftType);
    if (items.length === 0) {
      setLoadErr(`No checklist lines for ${row.shift.shiftType} shift on this routine.`);
      return;
    }

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
        extras: (opts?.extras ?? []).map((ex) => ({
          label: ex.label,
          assigned_to_user_id: row.worker.id,
        })),
      });
      const display = opts?.displayName ?? detail.name;
      setAssignedByRow((prev) => ({
        ...prev,
        [row.rowKey]: [
          ...(prev[row.rowKey] ?? []),
          {
            routineId,
            routineName: display,
            assignmentId: res.id,
            kind: opts?.kind ?? "routine",
            extraNote: opts?.extras?.[0]?.label,
          },
        ],
      }));
      setToast(`Assigned “${display}” to ${row.worker.name}.`);
    } catch (err) {
      const { message, status, requestUrl } = parseClientApiError(err);
      const hint =
        status === 400
          ? " Refresh the page after syncing arena routines, then try again."
          : status != null
            ? ` (HTTP ${status})`
            : "";
      const urlBit = requestUrl ? ` ${requestUrl}` : "";
      setLoadErr((message || "Could not save assignment.") + hint + urlBit);
    } finally {
      setSavingRowKey(null);
    }
  }

  async function syncArenaCatalog() {
    setSyncingArena(true);
    setLoadErr(null);
    try {
      const result = await ensureArenaRoutines();
      setRoutineDetails({});
      await reloadRoutines();
      const parts: string[] = [];
      if (result.created.length) parts.push(`created ${result.created.length}`);
      if (result.renamed.length) parts.push(`renamed ${result.renamed.length}`);
      if (result.updated.length) parts.push(`updated ${result.updated.length}`);
      setToast(parts.length ? `Arena catalog: ${parts.join(", ")}.` : "Arena routines already up to date.");
    } catch (err) {
      const { message } = parseClientApiError(err);
      setLoadErr(message || "Could not sync arena routines.");
    } finally {
      setSyncingArena(false);
    }
  }

  function rowOperationalBadges(row: ScheduledRow): string[] {
    const fromShift = (row.shift.operationalBadges ?? []).map((b) => b.trim().toUpperCase()).filter(Boolean);
    const fromLocal = (assignedByRow[row.rowKey] ?? [])
      .filter((a) => a.kind === "grounds")
      .map(() => "GROUNDS");
    return [...new Set([...fromShift, ...fromLocal])];
  }

  function handleRowDrop(e: React.DragEvent, row: ScheduledRow) {
    e.preventDefault();
    setHoverRowKey(null);

    const badgePayload = readRoutineBadgeDragPayload(e.dataTransfer);
    if (badgePayload?.badgeKind === "EXTRA") {
      setExtraModalRow(row);
      onBadgeDragEnd();
      return;
    }
    if (badgePayload?.badgeKind === "GROUNDS") {
      onAddOperationalBadge?.(row.worker.id, focusDate, "GROUNDS");
      setAssignedByRow((prev) => ({
        ...prev,
        [row.rowKey]: [
          ...(prev[row.rowKey] ?? []),
          { routineId: "grounds", routineName: "Grounds", kind: "grounds" },
        ],
      }));
      setToast(`Grounds badge added for ${row.worker.name}.`);
      onBadgeDragEnd();
      return;
    }

    const payload = readRoutineDragPayload(e.dataTransfer);
    const routineId = payload?.routineId ?? draggingRoutineId;
    const ev = eligibilityByRow[row.rowKey];
    if (!routineId) return;
    if (!ev?.eligible) {
      setLoadErr(ev?.tooltip ?? "Cannot assign this routine to this worker.");
      onRoutineDragEnd();
      return;
    }
    void assignRoutineToRow(row, routineId);
    onRoutineDragEnd();
  }

  function nudgeDate(delta: number) {
    const d = parseLocalDate(focusDate);
    d.setDate(d.getDate() + delta);
    onFocusDateChange(formatLocalDate(d));
  }

  function renderRoutineChip(r: RoutineRow, band: RoutineShiftBand | null) {
    return (
      <button
        key={r.id}
        type="button"
        draggable
        onDragStart={(e) => void onRoutineDragStart(e, r)}
        onDragEnd={onRoutineDragEnd}
        className={cn(
          "rounded-lg border px-2 py-2 text-left text-xs font-semibold transition-colors hover:opacity-90",
          routineChipClass(band),
          draggingRoutineId === r.id && "ring-2 ring-[var(--ds-accent)]",
        )}
        title={r.name}
      >
        <span className="line-clamp-2">{r.name}</span>
      </button>
    );
  }

  const extraDef = OPERATIONAL_BADGE_REGISTRY.EXTRA;
  const groundsDef = OPERATIONAL_BADGE_REGISTRY.GROUNDS;

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

      <ScheduleRoutineExtraModal
        open={extraModalRow !== null}
        workerName={extraModalRow?.worker.name ?? ""}
        routines={routines ?? []}
        onClose={() => setExtraModalRow(null)}
        onConfirm={(payload) => {
          const row = extraModalRow;
          setExtraModalRow(null);
          if (!row) return;
          void (async () => {
            onAddOperationalBadge?.(row.worker.id, focusDate, "EXTRA");
            if (payload.extraRoutineId) {
              const name =
                routines?.find((r) => r.id === payload.extraRoutineId)?.name ?? "Extra routine";
              await assignRoutineToRow(row, payload.extraRoutineId, {
                kind: "extra",
                displayName: name,
                extras: payload.comment
                  ? [{ label: payload.comment }]
                  : undefined,
              });
            } else if (payload.comment) {
              const sideLabel = payload.side === "a" ? "Arena A" : "Arena B";
              const fallback = routines?.find((r) =>
                r.name.toLowerCase().includes(`${sideLabel.toLowerCase()} — extra`),
              );
              if (fallback) {
                await assignRoutineToRow(row, fallback.id, {
                  kind: "extra",
                  displayName: `Extra · ${sideLabel}`,
                  extras: [{ label: payload.comment }],
                });
              } else {
                setLoadErr("Sync arena catalog to enable extra assignments with notes.");
              }
            }
          })();
        }}
      />

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
        ) : draggingBadge ? (
          <p className="text-xs text-ds-muted">
            Dragging <span className="font-semibold text-ds-foreground">{draggingBadge}</span> badge onto a worker row.
          </p>
        ) : (
          <p className="text-xs text-ds-muted">Drag routines or badges onto worker rows.</p>
        )}
      </div>

      {loadErr ? (
        <div className="rounded-xl border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-danger">
          {loadErr}
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(240px,300px)_1fr]">
        <aside className="max-h-[min(70vh,720px)] overflow-y-auto rounded-xl border border-pulseShell-border/90 bg-pulseShell-surface/95 p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/80">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[var(--ds-accent)]" aria-hidden />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Routine matrix</p>
                <p className="text-[11px] text-ds-muted">Arena A/B by shift · drag onto workers</p>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md border border-ds-border px-2 py-1 text-[10px] font-semibold text-ds-muted hover:bg-ds-interactive-hover disabled:opacity-50"
              disabled={syncingArena}
              onClick={() => void syncArenaCatalog()}
            >
              {syncingArena ? "Syncing…" : hasArenaCatalog ? "Refresh arena" : "Add arena set"}
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ds-muted">Coverage badges</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[extraDef, groundsDef].map((def) => (
                <button
                  key={def.code}
                  type="button"
                  draggable
                  title={def.detail}
                  onDragStart={(e) => onBadgeDragStart(e, def.code as RoutineBadgeKind)}
                  onDragEnd={onBadgeDragEnd}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide",
                    operationalBadgeClasses(def.group),
                    draggingBadge === def.code && "ring-2 ring-[var(--ds-accent)]",
                  )}
                >
                  {operationalBadgeChipLabel(def.code)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] leading-snug text-ds-muted">
              Extra opens a notes picker or Arena extra routine. Grounds tags exterior coverage on the shift.
            </p>
          </div>

          {routines === null ? (
            <p className="mt-3 text-sm text-ds-muted">Loading routines…</p>
          ) : (
            <div className="mt-3 space-y-3">
              {SHIFT_BANDS.map((band) => {
                const list = routineGroups.byShift[band];
                if (!list.length) return null;
                return (
                  <div key={band}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">
                      {ARENA_SHIFT_SECTION_LABELS[band]}
                    </p>
                    <div className="mt-1 grid grid-cols-1 gap-1.5">
                      {list.map((r) => renderRoutineChip(r, band))}
                    </div>
                  </div>
                );
              })}
              {routineGroups.extras.length > 0 ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Extra routines</p>
                  <div className="mt-1 grid grid-cols-1 gap-1.5">
                    {routineGroups.extras.map((r) => renderRoutineChip(r, null))}
                  </div>
                </div>
              ) : null}
              {routineGroups.other.length > 0 ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Other routines</p>
                  <div className="mt-1 grid grid-cols-1 gap-1.5">
                    {routineGroups.other.map((r) => renderRoutineChip(r, null))}
                  </div>
                </div>
              ) : null}
              {!hasArenaCatalog && routines.length > 0 ? (
                <p className="text-[11px] text-ds-muted">
                  Use <span className="font-semibold">Add arena set</span> to create day, afternoon, and night Arena A/B
                  routines with night-shift notes.
                </p>
              ) : null}
            </div>
          )}
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
                  const opBadges = rowOperationalBadges(row);
                  const isSaving = savingRowKey === row.rowKey;
                  const dropActive = draggingRoutineId || draggingBadge;

                  return (
                    <tr
                      key={row.rowKey}
                      className={cn(
                        "relative border-b border-ds-border/80 transition-colors",
                        highlight && workerHighlightOverlayClass(highlight),
                        hoverRowKey === row.rowKey &&
                          (draggingBadge || ev?.eligible) &&
                          "ring-1 ring-inset ring-[var(--ds-accent)]/30",
                      )}
                      onDragOver={(e) => {
                        const routineOk = routineDropZoneAccepts(e, draggingRoutineId);
                        const badgeOk = routineBadgeDropZoneAccepts(e, draggingBadge);
                        if (!routineOk && !badgeOk) return;
                        e.preventDefault();
                        if (draggingBadge) e.dataTransfer.dropEffect = "copy";
                        else e.dataTransfer.dropEffect = ev?.eligible ? "copy" : "none";
                        setHoverRowKey(row.rowKey);
                      }}
                      onDragLeave={() => {
                        if (hoverRowKey === row.rowKey) setHoverRowKey(null);
                      }}
                      onDrop={(e) => handleRowDrop(e, row)}
                    >
                      <td className="px-3 py-2.5 font-medium text-ds-foreground">{row.worker.name}</td>
                      <td className="px-3 py-2.5 text-ds-foreground">
                        {shiftTypeLabel(shiftTypes, row.shift.shiftType)} · {row.shift.startTime}–{row.shift.endTime}
                      </td>
                      <td className="px-3 py-2.5 text-ds-muted">{zoneLabel(row.shift.zoneId)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex min-h-[2rem] flex-wrap items-center gap-1">
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin text-ds-muted" aria-hidden />
                          ) : null}
                          {opBadges.map((code) => {
                            const def = OPERATIONAL_BADGE_REGISTRY[code];
                            return (
                              <span
                                key={code}
                                className={cn(
                                  "rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase",
                                  operationalBadgeClasses(def?.group ?? "special"),
                                )}
                                title={def?.detail}
                              >
                                {operationalBadgeChipLabel(code)}
                              </span>
                            );
                          })}
                          {assigned.length === 0 && !isSaving && !dropActive ? (
                            <span className="text-xs text-ds-muted">Drop routine or badge here</span>
                          ) : (
                            assigned
                              .filter((a) => a.kind !== "grounds")
                              .map((a) => (
                                <span
                                  key={`${a.routineId}-${a.assignmentId ?? "local"}`}
                                  className={cn(
                                    "rounded-md border px-2 py-0.5 text-xs font-medium",
                                    a.kind === "extra"
                                      ? "border-amber-300/80 bg-amber-50/90 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/60 dark:text-amber-100"
                                      : "border-violet-200/80 bg-violet-50/90 text-violet-900 dark:border-violet-500/30 dark:bg-violet-950/60 dark:text-violet-100",
                                  )}
                                  title={a.extraNote}
                                >
                                  {a.routineName}
                                  {a.extraNote ? ` — ${a.extraNote}` : ""}
                                </span>
                              ))
                          )}
                        </div>
                        {draggingRoutineId && ev?.tooltip ? (
                          <p className="mt-1 text-[10px] text-ds-muted" title={ev.tooltip}>
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
