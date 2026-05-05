"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Card } from "@/components/pulse/Card";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  createRoutineRun,
  getRoutine,
  listRoutines,
  type RoutineDetail,
  type RoutineRow,
} from "@/lib/routinesService";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5");
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-ds-border bg-ds-secondary px-3 py-2.5 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";

type RunItem = {
  routine_item_id: string;
  label: string;
  required: boolean;
  completed: boolean;
  note: string;
};

export function RoutineRun({
  shiftId,
  onCompleted,
}: {
  shiftId: string;
  onCompleted?: () => void;
}) {
  const [routines, setRoutines] = useState<RoutineRow[] | null>(null);
  const [routineId, setRoutineId] = useState<string>("");
  const [routine, setRoutine] = useState<RoutineDetail | null>(null);

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

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

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
      setRequireNotes(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await getRoutine(routineId);
        if (cancelled) return;
        setRoutine(d);
        const next: RunItem[] = (d.items ?? [])
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((it) => ({
            routine_item_id: it.id,
            label: it.label ?? "",
            required: it.required !== false,
            completed: false,
            note: "",
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
  }, [routineId]);

  async function signOff() {
    if (!routine || saving) return;
    setErr(null);

    // Enforce missed-item notes before submit.
    const incomplete = items.filter((i) => !i.completed);
    if (incomplete.length > 0) {
      setRequireNotes(true);
      const missing = incomplete.filter((i) => !(i.note || "").trim());
      if (missing.length > 0) {
        setToast("Add notes for missed items before sign-off.");
        return;
      }
    }

    setSaving(true);
    try {
      await createRoutineRun({
        routine_id: routine.id,
        shift_id: shiftId,
        items: items.map((i) => ({
          routine_item_id: i.routine_item_id,
          completed: Boolean(i.completed),
          note: i.completed ? null : (i.note || "").trim() || null,
        })),
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
                    </span>
                  </label>

                  {requireNotes && !it.completed ? (
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ds-border pt-4">
            <div className="text-xs font-medium text-ds-muted">
              {missed.length > 0 ? `${missed.length} missed item(s)` : "All items completed"}
              {requireNotes && missingNotes.length > 0 ? ` · ${missingNotes.length} note(s) missing` : ""}
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

