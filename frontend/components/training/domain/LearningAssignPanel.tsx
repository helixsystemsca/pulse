"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { fetchTrainingMatrix, postTrainingAssignments } from "@/lib/trainingApi";
import { fetchWorkerList, type WorkerRow } from "@/lib/workersService";
import { readSession } from "@/lib/pulse-session";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  readLearningBundlesForSession,
  procedureIdsInBundle,
  type LearningBundle,
} from "@/lib/training/learning-bundles";
import { cn } from "@/lib/cn";

type AssignTarget = "worker" | "role" | "department" | "team";
type AssignKind = "procedure" | "bundle";

function resolveTargetWorkerIds(
  target: AssignTarget,
  targetValue: string,
  workers: WorkerRow[],
): string[] {
  if (target === "worker") return targetValue ? [targetValue] : [];
  if (!targetValue.trim()) return [];
  const v = targetValue.trim().toLowerCase();
  if (target === "department") {
    return workers
      .filter((w) => w.is_active && (w.department ?? "").toLowerCase() === v)
      .map((w) => w.id);
  }
  if (target === "role") {
    return workers
      .filter(
        (w) =>
          w.is_active &&
          (w.role?.toLowerCase() === v ||
            w.resolved_matrix_slot?.toLowerCase() === v ||
            (w.roles ?? []).some((r) => r.toLowerCase() === v)),
      )
      .map((w) => w.id);
  }
  if (target === "team") {
    return workers
      .filter(
        (w) =>
          w.is_active &&
          (w.matrix_slot?.toLowerCase() === v || w.resolved_matrix_slot?.toLowerCase() === v),
      )
      .map((w) => w.id);
  }
  return [];
}

/** Supervisor assign workflow — procedures or Learning Bundles to workers, roles, departments, or teams. */
export function LearningAssignPanel() {
  const session = readSession();
  const companyId = session?.company_id ?? null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [programs, setPrograms] = useState<{ id: string; title: string }[]>([]);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [bundles, setBundles] = useState<LearningBundle[]>([]);

  const [assignKind, setAssignKind] = useState<AssignKind>("procedure");
  const [procedureId, setProcedureId] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [target, setTarget] = useState<AssignTarget>("worker");
  const [targetValue, setTargetValue] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [matrix, roster] = await Promise.all([
          fetchTrainingMatrix(),
          fetchWorkerList(companyId, { include_inactive: false }),
        ]);
        if (cancelled) return;
        setPrograms(
          (matrix.programs ?? [])
            .filter((p) => p.active)
            .map((p) => ({ id: p.id, title: p.title }))
            .sort((a, b) => a.title.localeCompare(b.title)),
        );
        setWorkers(roster.items ?? []);
        setBundles(readLearningBundlesForSession().filter((b) => b.active));
      } catch (e) {
        if (!cancelled) setErr(parseClientApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const selectedBundle = useMemo(
    () => bundles.find((b) => b.id === bundleId),
    [bundles, bundleId],
  );

  const procedureIdsToAssign = useMemo(() => {
    if (assignKind === "procedure") return procedureId ? [procedureId] : [];
    if (!selectedBundle) return [];
    return procedureIdsInBundle(selectedBundle);
  }, [assignKind, procedureId, selectedBundle]);

  const targetOptions = useMemo(() => {
    if (target === "worker") {
      return workers
        .filter((w) => w.is_active)
        .map((w) => ({ value: w.id, label: w.full_name ?? w.email }));
    }
    if (target === "department") {
      const deps = new Set<string>();
      for (const w of workers) {
        if (w.department?.trim()) deps.add(w.department.trim());
      }
      return [...deps].sort().map((d) => ({ value: d.toLowerCase(), label: d }));
    }
    if (target === "role") {
      const roles = new Set<string>();
      for (const w of workers) {
        if (w.resolved_matrix_slot?.trim()) roles.add(w.resolved_matrix_slot.trim());
        else if (w.role?.trim()) roles.add(w.role.trim());
      }
      return [...roles].sort().map((r) => ({ value: r.toLowerCase(), label: r }));
    }
    const teams = new Set<string>();
    for (const w of workers) {
      const t = w.matrix_slot_display ?? w.matrix_slot ?? w.resolved_matrix_slot;
      if (t?.trim()) teams.add(t.trim());
    }
    return [...teams].sort().map((t) => ({ value: t.toLowerCase(), label: t }));
  }, [target, workers]);

  const handleAssign = useCallback(async () => {
    setErr(null);
    setSuccess(null);
    const employeeIds = resolveTargetWorkerIds(target, targetValue, workers);
    if (employeeIds.length === 0) {
      setErr("Select a target with at least one active worker.");
      return;
    }
    if (procedureIdsToAssign.length === 0) {
      setErr(assignKind === "bundle" ? "Bundle has no procedures yet." : "Select a procedure.");
      return;
    }
    setSubmitting(true);
    try {
      let total = 0;
      for (const pid of procedureIdsToAssign) {
        const created = await postTrainingAssignments({
          procedure_id: pid,
          employee_user_ids: employeeIds,
          due_date: dueDate || null,
          use_compliance_due_window: !dueDate,
        });
        total += created.length;
      }
      setSuccess(
        `Assigned ${procedureIdsToAssign.length} item(s) to ${employeeIds.length} worker(s) (${total} assignment row(s)). Compliance updates after completion.`,
      );
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSubmitting(false);
    }
  }, [target, targetValue, workers, procedureIdsToAssign, assignKind, dueDate]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ds-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading assign tools…
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-ds-border bg-ds-primary p-4 shadow-sm dark:bg-ds-secondary/20">
      <div>
        <h3 className="text-base font-semibold text-ds-foreground">Assign learning</h3>
        <p className="mt-1 text-sm text-ds-muted">
          Assign a procedure or Learning Bundle to workers, a role, department, or team. Completion flows through Learning;
          Compliance reflects verified state.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["procedure", "bundle"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAssignKind(k)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
              assignKind === k
                ? "bg-ds-primary text-white ring-2 ring-ds-primary"
                : "bg-ds-muted/20 text-ds-muted hover:text-ds-foreground",
            )}
          >
            {k === "procedure" ? "Single procedure" : "Learning bundle"}
          </button>
        ))}
      </div>

      {assignKind === "procedure" ? (
        <label className="block text-sm">
          <span className="font-medium text-ds-foreground">Procedure</span>
          <select
            className="mt-1 w-full max-w-md rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
            value={procedureId}
            onChange={(e) => setProcedureId(e.target.value)}
          >
            <option value="">Select procedure…</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block text-sm">
          <span className="font-medium text-ds-foreground">Learning bundle</span>
          <select
            className="mt-1 w-full max-w-md rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
            value={bundleId}
            onChange={(e) => setBundleId(e.target.value)}
          >
            <option value="">Select bundle…</option>
            {bundles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
                {procedureIdsInBundle(b).length === 0 ? " (no procedures)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium text-ds-foreground">Assign to</span>
          <select
            className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value as AssignTarget);
              setTargetValue("");
            }}
          >
            <option value="worker">Worker</option>
            <option value="role">Role</option>
            <option value="department">Department</option>
            <option value="team">Team</option>
          </select>
        </label>
        <label className="block text-sm sm:col-span-1 lg:col-span-2">
          <span className="font-medium text-ds-foreground">
            {target === "worker" ? "Worker" : target.charAt(0).toUpperCase() + target.slice(1)}
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
          >
            <option value="">Select…</option>
            {targetOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ds-foreground">Due date (optional)</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
      </div>

      {err ? (
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
          {err}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status">
          {success}
        </p>
      ) : null}

      <button
        type="button"
        disabled={submitting}
        onClick={() => void handleAssign()}
        className="inline-flex items-center gap-2 rounded-lg bg-ds-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Assign
      </button>
    </section>
  );
}
