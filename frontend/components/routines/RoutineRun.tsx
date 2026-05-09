"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { Card } from "@/components/pulse/Card";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { readSession } from "@/lib/pulse-session";
import {
  createRoutineRun,
  fetchScheduleShift,
  getRoutine,
  listRoutines,
  listMyRoutineAssignments,
  type RoutineDetail,
  type RoutineRow,
} from "@/lib/routinesService";
import { filterRoutineItemsForShiftBand } from "@/lib/routines/shiftBands";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5");
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-ds-border bg-ds-secondary px-3 py-2.5 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";

type RunItem = {
  routine_item_id: string;
  label: string;
  procedure_id: string | null;
  required: boolean;
  completed: boolean;
  note: string;
  assigned_to_user_id: string | null;
};

export function RoutineRun({
  shiftId,
  onCompleted,
}: {
  shiftId: string;
  onCompleted?: () => void;
}) {
  const session = readSession();
  const currentUserId = session?.sub ?? null;
  const [routines, setRoutines] = useState<RoutineRow[] | null>(null);
  const [routineId, setRoutineId] = useState<string>("");
  const [routine, setRoutine] = useState<RoutineDetail | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [assignmentExtras, setAssignmentExtras] = useState<
    Array<{ id: string; label: string; assigned_to_user_id: string | null; completed: boolean; note: string }>
  >([]);

  const [items, setItems] = useState<RunItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [requireNotes, setRequireNotes] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const missed = useMemo(() => items.filter((i) => !i.completed), [items]);
  const missingNotes = useMemo(
    () => missed.filter((i) => !(i.note || "").trim()),
    [missed],
  );
  const extraMissed = useMemo(() => assignmentExtras.filter((e) => !e.completed), [assignmentExtras]);
  const extraMissingNotes = useMemo(
    () => extraMissed.filter((e) => !(e.note || "").trim()),
    [extraMissed],
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // If there are assignments for this shift, prefer execution from the assignment context.
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listMyRoutineAssignments({ shift_id: shiftId });
        if (cancelled) return;
        // MVP: pick the most recent assignment.
        const a = list[0] ?? null;
        if (!a) return;
        setAssignmentId(a.id);
        setRoutineId(a.routine_id);
        setRoutine(a.routine);
        const itemAssignMap = new Map(
          (a.item_assignments ?? [])
            .filter((x) => x.routine_item_id)
            .map((x) => [x.routine_item_id as string, x.assigned_to_user_id]),
        );
        const primary = a.primary_user_id ?? null;
        const next: RunItem[] = (a.routine.items ?? [])
          .slice()
          .sort((aa, bb) => (aa.position ?? 0) - (bb.position ?? 0))
          .map((it) => ({
            routine_item_id: it.id,
            label: it.label ?? "",
            procedure_id: it.procedure_id?.trim() ? it.procedure_id : null,
            required: it.required !== false,
            completed: false,
            note: "",
            assigned_to_user_id: itemAssignMap.get(it.id) ?? primary,
          }));
        setItems(next);
        setAssignmentExtras(
          (a.extras ?? []).map((e) => ({
            id: e.id,
            label: e.label,
            assigned_to_user_id: (e.assigned_to_user_id ?? primary) as string | null,
            completed: Boolean(e.completed),
            note: (e.note ?? "").toString(),
          })),
        );
        setRequireNotes(false);
      } catch {
        // ignore: routine execution can still be manual without assignment context
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shiftId, currentUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listRoutines();
        if (cancelled) return;
        setRoutines(list);
        setErr(null);
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
  }, []);

  useEffect(() => {
    if (!routineId) {
      setRoutine(null);
      setItems([]);
      setAssignmentId(null);
      setAssignmentExtras([]);
      setRequireNotes(false);
      return;
    }
    // Assignment context loads routine + items from server (shift-filtered).
    if (assignmentId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await getRoutine(routineId);
        if (cancelled) return;
        setRoutine(d);
        let template = (d.items ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        if (shiftId) {
          try {
            const sh = await fetchScheduleShift(shiftId);
            template = filterRoutineItemsForShiftBand(template, sh.routine_shift_band ?? null);
          } catch {
            /* keep full template if shift lookup fails */
          }
        }
        const next: RunItem[] = template.map((it) => ({
          routine_item_id: it.id,
          label: it.label ?? "",
          procedure_id: it.procedure_id?.trim() ? it.procedure_id : null,
          required: it.required !== false,
          completed: false,
          note: "",
          assigned_to_user_id: currentUserId,
        }));
        setItems(next);
        setRequireNotes(false);
        setErr(null);
      } catch (e) {
        if (!cancelled) {
          const { message } = parseClientApiError(e);
          setErr(message || "Could not load routine.");
          setRoutine(null);
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routineId, assignmentId, shiftId, currentUserId]);

  async function signOff() {
    if (!routine || saving) return;
    setErr(null);

    // Enforce missed-item notes before submit (items + extras).
    const incomplete = items.filter((i) => !i.completed);
    if (incomplete.length > 0) {
      setRequireNotes(true);
      const missing = incomplete.filter((i) => !(i.note || "").trim());
      if (missing.length > 0) {
        setToast("Add notes for missed items before sign-off.");
        return;
      }
    }
    if (extraMissed.length > 0) {
      setRequireNotes(true);
      if (extraMissingNotes.length > 0) {
        setToast("Add notes for missed extra tasks before sign-off.");
        return;
      }
    }

    setSaving(true);
    try {
      await createRoutineRun({
        routine_id: routine.id,
        shift_id: shiftId,
        routine_assignment_id: assignmentId,
        items: items.map((i) => ({
          routine_item_id: i.routine_item_id,
          completed: Boolean(i.completed),
          note: i.completed ? null : (i.note || "").trim() || null,
        })),
        extras: assignmentId
          ? assignmentExtras.map((e) => ({
              id: e.id,
              completed: Boolean(e.completed),
              note: e.completed ? null : (e.note || "").trim() || null,
            }))
          : [],
      });
      setToast("Routine signed off.");
      onCompleted?.();
    } catch (e) {
      const { message } = parseClientApiError(e);
      setErr(message || "Could not sign off routine.");
    } finally {
      setSaving(false);
    }
  }

  if (routines === null) {
    return (
      <div className="flex min-h-[18vh] items-center justify-center text-sm text-ds-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Loading routines…
      </div>
    );
  }

  return (
    <Card padding="md" className="space-y-4">
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg dark:border-emerald-500/35 dark:bg-emerald-950/95 dark:text-emerald-100"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {err ? (
        <div className="rounded-xl border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-danger shadow-sm">
          {err}
        </div>
      ) : null}

      <div>
        <label className={LABEL} htmlFor="run-routine">
          Routine
        </label>
        <select
          id="run-routine"
          className={FIELD}
          value={routineId}
          onChange={(e) => setRoutineId(e.target.value)}
          disabled={saving}
        >
          <option value="">Select a routine…</option>
          {routines.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {!routine ? (
        <p className="text-sm text-ds-muted">Choose a routine to begin.</p>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ds-foreground">Checklist</p>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.routine_item_id} className="rounded-lg border border-ds-border bg-ds-secondary p-3">
                  {currentUserId && it.assigned_to_user_id && it.assigned_to_user_id !== currentUserId ? (
                    <div className="text-sm text-ds-muted">
                      <span className="font-semibold text-ds-foreground">{it.label}</span>
                      <span className="ml-2 text-[11px]">Assigned to another worker</span>
                      {it.procedure_id ? (
                        <div className="mt-1">
                          <Link
                            href="/standards/procedures"
                            className="text-xs font-semibold text-ds-foreground underline decoration-ds-border underline-offset-2"
                          >
                            Open procedure (SOP)
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-ds-border"
                        checked={it.completed}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.routine_item_id === it.routine_item_id
                                ? { ...x, completed: e.target.checked }
                                : x,
                            ),
                          )
                        }
                        disabled={saving}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ds-foreground">
                          {it.label}
                          {it.required ? (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-ds-muted">
                              required
                            </span>
                          ) : null}
                        </span>
                        {it.procedure_id ? (
                          <Link
                            href="/standards/procedures"
                            className="mt-1 inline-block text-xs font-semibold text-ds-foreground underline decoration-ds-border underline-offset-2 hover:decoration-ds-foreground"
                          >
                            Open procedure (SOP)
                          </Link>
                        ) : null}
                      </span>
                    </label>
                  )}

                  {requireNotes && !it.completed && (!it.assigned_to_user_id || it.assigned_to_user_id === currentUserId) ? (
                    <div className="mt-3">
                      <label className={LABEL} htmlFor={`missed-${it.routine_item_id}`}>
                        Missed-item note (required)
                      </label>
                      <textarea
                        id={`missed-${it.routine_item_id}`}
                        rows={2}
                        className={FIELD}
                        value={it.note}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.routine_item_id === it.routine_item_id
                                ? { ...x, note: e.target.value }
                                : x,
                            ),
                          )
                        }
                        placeholder="Explain why this was not completed"
                        disabled={saving}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {assignmentId && assignmentExtras.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ds-foreground">Extra tasks</p>
              <div className="space-y-2">
                {assignmentExtras.map((ex) => {
                  const mine = !currentUserId || !ex.assigned_to_user_id || ex.assigned_to_user_id === currentUserId;
                  return (
                    <div key={ex.id} className="rounded-lg border border-ds-border bg-ds-secondary p-3">
                      {mine ? (
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-ds-border"
                            checked={ex.completed}
                            onChange={(e) =>
                              setAssignmentExtras((prev) =>
                                prev.map((x) => (x.id === ex.id ? { ...x, completed: e.target.checked } : x)),
                              )
                            }
                            disabled={saving}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ds-foreground">{ex.label}</span>
                            <span className="mt-1 inline-flex rounded-full border border-ds-border bg-ds-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ds-muted">
                              extra
                            </span>
                          </span>
                        </label>
                      ) : (
                        <div className="text-sm text-ds-muted">
                          <span className="font-semibold text-ds-foreground">{ex.label}</span>
                          <span className="ml-2 text-[11px]">Assigned to another worker</span>
                        </div>
                      )}
                      {requireNotes && !ex.completed && mine ? (
                        <div className="mt-3">
                          <label className={LABEL} htmlFor={`ex-note-${ex.id}`}>
                            Missed-item note (required)
                          </label>
                          <textarea
                            id={`ex-note-${ex.id}`}
                            rows={2}
                            className={FIELD}
                            value={ex.note}
                            onChange={(e) =>
                              setAssignmentExtras((prev) =>
                                prev.map((x) => (x.id === ex.id ? { ...x, note: e.target.value } : x)),
                              )
                            }
                            placeholder="Explain why this was not completed"
                            disabled={saving}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ds-border pt-4">
            <div className="text-xs font-medium text-ds-muted">
              {missed.length > 0 ? `${missed.length} missed item(s)` : "All items completed"}
              {requireNotes && missingNotes.length > 0 ? ` · ${missingNotes.length} note(s) missing` : ""}
              {assignmentId ? ` · extras: ${assignmentExtras.filter((e) => !e.completed).length} missed` : ""}
            </div>
            <button
              type="button"
              className={PRIMARY_BTN}
              onClick={() => void signOff()}
              disabled={saving || !routineId}
            >
              <span className="inline-flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                {saving ? "Signing off…" : "Complete / Sign off"}
              </span>
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

