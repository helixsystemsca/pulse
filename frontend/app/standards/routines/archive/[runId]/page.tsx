"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/pulse/Card";
import { apiFetch } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { getRoutine, getRoutineRun, type RoutineDetail, type RoutineRunDetail } from "@/lib/routinesService";
import type { PulseWorkerApi } from "@/lib/schedule/pulse-bridge";

function nameFor(userId: string | null | undefined, workersById: Map<string, PulseWorkerApi>): string {
  if (!userId) return "—";
  const w = workersById.get(userId);
  return (w?.full_name || w?.email || userId).toString();
}

export default function RoutineRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = params?.runId;

  const [run, setRun] = useState<RoutineRunDetail | null>(null);
  const [routine, setRoutine] = useState<RoutineDetail | null>(null);
  const [workers, setWorkers] = useState<PulseWorkerApi[]>([]);
  const workersById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    setRun(null);
    setRoutine(null);
    void (async () => {
      if (!runId) return;
      try {
        const rr = await getRoutineRun(String(runId));
        if (cancelled) return;
        setRun(rr);
        const r = await getRoutine(rr.routine_id);
        if (!cancelled) setRoutine(r);
      } catch (e) {
        if (!cancelled) {
          const { message } = parseClientApiError(e);
          setErr(message || "Could not load routine run.");
        }
      }
    })();
    void (async () => {
      try {
        const w = await apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers");
        if (!cancelled) setWorkers(w);
      } catch {
        if (!cancelled) setWorkers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (err) {
    return (
      <Card padding="md">
        <p className="text-sm font-semibold text-ds-danger">{err}</p>
        <div className="mt-3">
          <Link className="text-sm font-semibold text-ds-foreground underline" href="/standards/routines/archive">
            Back to archive
          </Link>
        </div>
      </Card>
    );
  }

  if (!run || !routine) {
    return <p className="text-sm text-ds-muted">Loading…</p>;
  }

  const itemLabelById = new Map((routine.items ?? []).map((i) => [i.id, i.label]));
  const itemProcedureById = new Map(
    (routine.items ?? []).filter((i) => i.procedure_id?.trim()).map((i) => [i.id, i.procedure_id as string]),
  );
  const completedAt = run.completed_at || run.started_at;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ds-foreground">{routine.name}</p>
          <p className="mt-1 text-sm text-ds-muted">
            Run: {String(run.id).slice(0, 8)} · {new Date(completedAt).toLocaleString()}
          </p>
        </div>
        <Link
          href="/standards/routines/archive"
          className="inline-flex items-center gap-2 rounded-md border border-ds-border bg-ds-secondary px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
        >
          Back to archive
        </Link>
      </div>

      <Card padding="md" className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">Attribution</p>
        <p className="text-sm text-ds-foreground">
          <span className="font-semibold">Completed by:</span> {nameFor(run.user_id, workersById)}
        </p>
        {run.shift_id ? (
          <p className="text-sm text-ds-foreground">
            <span className="font-semibold">Shift:</span> {run.shift_id}
          </p>
        ) : null}
        {run.routine_assignment_id ? (
          <p className="text-sm text-ds-foreground">
            <span className="font-semibold">Assignment:</span> {run.routine_assignment_id}
          </p>
        ) : null}
      </Card>

      <Card padding="md" className="space-y-3">
        <p className="text-sm font-bold text-ds-foreground">Checklist</p>
        <div className="space-y-2">
          {run.items.map((it) => {
            const label = it.routine_item_id ? itemLabelById.get(it.routine_item_id) : null;
            const procId = it.routine_item_id ? itemProcedureById.get(it.routine_item_id) : undefined;
            return (
              <div key={it.id} className="rounded-lg border border-ds-border bg-ds-secondary p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ds-foreground">{label ?? it.routine_item_id ?? "Item"}</p>
                    {procId ? (
                      <Link
                        href="/standards/procedures"
                        className="mt-1 inline-block text-xs font-semibold text-ds-foreground underline underline-offset-2"
                      >
                        Linked procedure (SOP)
                      </Link>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      it.completed
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-950/40 dark:text-emerald-100"
                        : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100"
                    }`}
                  >
                    {it.completed ? "completed" : "missed"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ds-muted">
                  Completed by: {nameFor(it.completed_by_user_id ?? null, workersById)}
                </p>
                {!it.completed && it.note ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ds-foreground">
                    <span className="font-semibold">Note:</span> {it.note}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      {run.extras?.length ? (
        <Card padding="md" className="space-y-3">
          <p className="text-sm font-bold text-ds-foreground">Extra tasks</p>
          <div className="space-y-2">
            {run.extras.map((ex) => (
              <div key={ex.id} className="rounded-lg border border-ds-border bg-ds-secondary p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ds-foreground">{ex.label}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      ex.completed
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-950/40 dark:text-emerald-100"
                        : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100"
                    }`}
                  >
                    {ex.completed ? "completed" : "missed"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ds-muted">
                  Assigned to: {nameFor(ex.assigned_to_user_id ?? null, workersById)} · Completed by:{" "}
                  {nameFor(ex.completed_by_user_id ?? null, workersById)}
                </p>
                {!ex.completed && ex.note ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ds-foreground">
                    <span className="font-semibold">Note:</span> {ex.note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

