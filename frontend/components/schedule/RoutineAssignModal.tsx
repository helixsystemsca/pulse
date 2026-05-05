"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, X } from "lucide-react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import type { Shift, ShiftTypeConfig, Worker } from "@/lib/schedule/types";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { apiFetch } from "@/lib/api";

type RoutineRow = { id: string; name: string };
type RoutineDetail = {
  id: string;
  name: string;
  items: Array<{ id: string; label: string; required: boolean; position: number }>;
};

type ExtraDraft = { key: string; label: string; assigned_to_user_id: string };

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
const SECONDARY_BTN = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2");
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-ds-border bg-ds-secondary px-3 py-2.5 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function RoutineAssignModal({
  open,
  onClose,
  shiftDate,
  workers,
  shiftTypes,
  shiftsOnDay,
  initialShiftType,
}: {
  open: boolean;
  onClose: () => void;
  shiftDate: string; // YYYY-MM-DD
  workers: Worker[];
  shiftTypes: ShiftTypeConfig[];
  shiftsOnDay: Shift[];
  initialShiftType: string;
}) {
  const [selectedShiftType, setSelectedShiftType] = useState(initialShiftType);
  const [routines, setRoutines] = useState<RoutineRow[] | null>(null);
  const [routineId, setRoutineId] = useState("");
  const [routine, setRoutine] = useState<RoutineDetail | null>(null);

  const [primaryUserId, setPrimaryUserId] = useState("");
  const [itemAssignments, setItemAssignments] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<ExtraDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const activeWorkers = useMemo(() => workers.filter((w) => w.active), [workers]);

  const resolvedShift = useMemo(() => {
    const candidates = shiftsOnDay
      .filter((s) => s.date === shiftDate && s.shiftKind !== "project_task" && s.shiftType === selectedShiftType)
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return candidates[0] ?? null;
  }, [shiftsOnDay, shiftDate, selectedShiftType]);

  useEffect(() => {
    if (!open) return;
    setSelectedShiftType(initialShiftType);
    setRoutineId("");
    setRoutine(null);
    setItemAssignments({});
    setExtras([]);
    setPrimaryUserId("");
    setErr(null);
  }, [open, initialShiftType]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setErr(null);
    setRoutines(null);
    void (async () => {
      try {
        const list = await apiFetch<RoutineRow[]>("/api/v1/routines");
        if (!cancelled) setRoutines(list);
      } catch (e) {
        if (!cancelled) {
          const { message } = parseClientApiError(e);
          setErr(message || "Could not load routines.");
          setRoutines([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!routineId) {
      setRoutine(null);
      setItemAssignments({});
      return;
    }
    let cancelled = false;
    setErr(null);
    void (async () => {
      try {
        const d = await apiFetch<RoutineDetail>(`/api/v1/routines/${routineId}`);
        if (cancelled) return;
        setRoutine(d);
        setItemAssignments({});
      } catch (e) {
        if (!cancelled) {
          const { message } = parseClientApiError(e);
          setErr(message || "Could not load routine.");
          setRoutine(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, routineId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function saveAssignment() {
    if (!routineId || !primaryUserId || !resolvedShift || saving) return;
    setSaving(true);
    setErr(null);
    try {
      await apiFetch("/api/v1/routines/assignments", {
        method: "POST",
        body: JSON.stringify({
          routine_id: routineId,
          primary_user_id: primaryUserId,
          date: shiftDate,
          shift_id: resolvedShift.id,
          item_assignments: Object.entries(itemAssignments)
            .filter(([, uid]) => uid)
            .map(([routine_item_id, assigned_to_user_id]) => ({
              routine_item_id,
              assigned_to_user_id,
              reason: "manual",
            })),
          extras: extras
            .map((x) => ({ label: x.label.trim(), assigned_to_user_id: x.assigned_to_user_id || null }))
            .filter((x) => x.label),
        }),
      });
      setToast("Routine assigned.");
      onClose();
    } catch (e) {
      const { message } = parseClientApiError(e);
      setErr(message || "Could not save assignment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PulseDrawer
      open={open}
      onClose={onClose}
      title="Assign routine"
      subtitle="Assign a routine to a primary worker, delegate specific items, and add extras."
      placement="center"
      labelledBy="routine-assign-title"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button type="button" className={SECONDARY_BTN} onClick={onClose} disabled={saving}>
            <span className="inline-flex items-center gap-2">
              <X className="h-4 w-4" aria-hidden />
              Cancel
            </span>
          </button>
          <button
            type="button"
            className={PRIMARY_BTN}
            onClick={() => void saveAssignment()}
            disabled={saving || !routineId || !primaryUserId || !resolvedShift}
          >
            <span className="inline-flex items-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
              {saving ? "Saving…" : "Save assignment"}
            </span>
          </button>
        </div>
      }
    >
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[250] max-w-md -translate-x-1/2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg dark:border-emerald-500/35 dark:bg-emerald-950/95 dark:text-emerald-100" role="status">
          {toast}
        </div>
      ) : null}

      {err ? (
        <div className="rounded-xl border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-danger shadow-sm">
          {err}
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <label className={LABEL} htmlFor="ra-shift-type">
            Shift
          </label>
          <select
            id="ra-shift-type"
            className={FIELD}
            value={selectedShiftType}
            onChange={(e) => {
              setSelectedShiftType(e.target.value);
              setRoutineId("");
              setRoutine(null);
              setItemAssignments({});
              setExtras([]);
            }}
            disabled={saving}
          >
            {shiftTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label || t.key}
              </option>
            ))}
          </select>
          {!resolvedShift ? (
            <p className="mt-2 text-sm text-ds-danger">
              No workforce shift for this type on this day. Add or pick a shift on the calendar first.
            </p>
          ) : (
            <p className="mt-2 text-xs text-ds-muted">
              Assigning to{" "}
              <span className="font-semibold text-ds-foreground">
                {resolvedShift.startTime}–{resolvedShift.endTime}
              </span>
              .
            </p>
          )}
        </div>

        <div>
          <label className={LABEL} htmlFor="ra-routine">
            Routine
          </label>
          <select
            id="ra-routine"
            className={FIELD}
            value={routineId}
            onChange={(e) => setRoutineId(e.target.value)}
            disabled={saving || !resolvedShift}
          >
            <option value="">{routines === null ? "Loading…" : "Select routine…"}</option>
            {(routines ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="ra-primary">
            Primary worker
          </label>
          <select
            id="ra-primary"
            className={FIELD}
            value={primaryUserId}
            onChange={(e) => setPrimaryUserId(e.target.value)}
            disabled={saving || !resolvedShift}
          >
            <option value="">Select worker…</option>
            {activeWorkers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        {routine?.items?.length ? (
          <div className="space-y-2">
            <p className={LABEL}>Task reassignment (optional)</p>
            <div className="space-y-2">
              {routine.items
                .slice()
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                .map((it) => (
                  <div key={it.id} className="rounded-lg border border-ds-border bg-ds-secondary p-3">
                    <p className="text-sm font-semibold text-ds-foreground">{it.label}</p>
                    <p className="mt-0.5 text-xs text-ds-muted">
                      Default: primary worker{it.required ? " · required" : " · optional"}
                    </p>
                    <div className="mt-2">
                      <label className={LABEL} htmlFor={`ra-item-${it.id}`}>
                        Assign to (override)
                      </label>
                      <select
                        id={`ra-item-${it.id}`}
                        className={FIELD}
                        value={itemAssignments[it.id] ?? ""}
                        onChange={(e) => setItemAssignments((prev) => ({ ...prev, [it.id]: e.target.value }))}
                        disabled={saving}
                      >
                        <option value="">Primary worker</option>
                        {activeWorkers.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className={LABEL}>Extras</p>
            <button
              type="button"
              className={cn(SECONDARY_BTN, "px-3 py-2")}
              onClick={() => setExtras((prev) => [...prev, { key: newKey(), label: "", assigned_to_user_id: "" }])}
              disabled={saving}
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" aria-hidden />
                Add extra
              </span>
            </button>
          </div>
          {extras.length === 0 ? <p className="text-sm text-ds-muted">No extra tasks added.</p> : null}
          <div className="space-y-2">
            {extras.map((ex) => (
              <div key={ex.key} className="rounded-lg border border-ds-border bg-ds-secondary p-3">
                <label className={LABEL} htmlFor={`ra-ex-${ex.key}`}>
                  Label
                </label>
                <input
                  id={`ra-ex-${ex.key}`}
                  className={FIELD}
                  value={ex.label}
                  onChange={(e) => setExtras((prev) => prev.map((x) => (x.key === ex.key ? { ...x, label: e.target.value } : x)))}
                  placeholder="e.g. Backwash filter"
                  disabled={saving}
                />
                <label className={LABEL} htmlFor={`ra-ex-assign-${ex.key}`}>
                  Assign to
                </label>
                <select
                  id={`ra-ex-assign-${ex.key}`}
                  className={FIELD}
                  value={ex.assigned_to_user_id}
                  onChange={(e) => setExtras((prev) => prev.map((x) => (x.key === ex.key ? { ...x, assigned_to_user_id: e.target.value } : x)))}
                  disabled={saving}
                >
                  <option value="">Primary worker</option>
                  {activeWorkers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={cn(SECONDARY_BTN, "mt-2")}
                  onClick={() => setExtras((prev) => prev.filter((x) => x.key !== ex.key))}
                  disabled={saving}
                >
                  Remove extra
                </button>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-ds-muted">
          TODO: enforce certification rules strictly (optional) · auto-suggest certified users · drag-and-drop assignment · load balancing
        </p>
      </div>
    </PulseDrawer>
  );
}

