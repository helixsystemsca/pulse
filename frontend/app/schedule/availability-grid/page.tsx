"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { preferSchedulePeriodIdForSupervisor } from "@/lib/schedule/period-utils";

type Period = {
  id: string;
  start_date: string;
  end_date: string;
  availability_deadline?: string | null;
  status: string;
};

type Worker = { id: string; email: string; full_name?: string | null; role: string; roles?: string[] };

type Submission = {
  id: string;
  company_id: string;
  worker_id: string;
  period_id: string;
  submitted_at: string;
  windows: Record<string, unknown>;
  exceptions: unknown[];
};

const FIELD =
  "w-full rounded-md border border-pulseShell-border bg-pulseShell-surface px-3 py-2 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ds-primary/40";

export default function AvailabilityGridPage() {
  const [ready, setReady] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [rows, setRows] = useState<Submission[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!readSession()) {
      navigateToPulseLogin();
      return;
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        const [p, w] = await Promise.all([
          apiFetch<Period[]>("/api/v1/pulse/schedule/periods"),
          apiFetch<Worker[]>("/api/v1/pulse/workers"),
        ]);
        setPeriods(p);
        setWorkers(w);
        setPeriodId(preferSchedulePeriodIdForSupervisor(p));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not load schedule data.");
      }
    })();
  }, [ready]);

  async function loadSubmissions(pid: string) {
    if (!pid) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<Submission[]>(`/api/v1/pulse/schedule/availability?period_id=${encodeURIComponent(pid)}`);
      setRows(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load availability submissions.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!ready || !periodId) return;
    void loadSubmissions(periodId);
  }, [ready, periodId]);

  const selected = useMemo(() => periods.find((p) => p.id === periodId) ?? null, [periodId, periods]);

  const submittedSet = useMemo(() => new Set(rows.map((r) => r.worker_id)), [rows]);
  const missing = useMemo(() => workers.filter((w) => !submittedSet.has(w.id)), [workers, submittedSet]);
  const workerName = (w: Worker) => (w.full_name || w.email || "User").trim();

  if (!ready) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-pulse-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ds-foreground">Availability grid (supervisor)</h1>
          <p className="mt-1 text-sm text-ds-muted">Phase 2 (minimal). Submitted vs not submitted for a period.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/schedule/availability" className="text-sm font-semibold text-ds-accent underline">
            My availability
          </a>
          <a href="/schedule" className="text-sm font-semibold text-ds-accent underline">
            Back to Schedule
          </a>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-md border border-ds-danger/40 bg-ds-danger/10 px-3 py-2 text-sm text-ds-foreground">{err}</div>
      ) : null}

      <div className="mt-6 rounded-md border border-pulseShell-border bg-pulseShell-surface p-4">
        <label className="text-xs font-semibold text-ds-muted">Schedule period</label>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <select className={`${FIELD} max-w-xl`} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">Select…</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.start_date} → {p.end_date} ({p.status})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-md border border-pulseShell-border bg-pulseShell-elevated px-3 py-2 text-sm font-semibold text-ds-foreground disabled:opacity-60"
            onClick={() => loadSubmissions(periodId)}
            disabled={busy || !periodId}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            className="rounded-md border border-pulseShell-border bg-ds-warning/10 px-3 py-2 text-sm font-semibold text-ds-foreground opacity-60"
            disabled
            title="Reminder sending is not wired yet. Use internal cron endpoint when ready."
          >
            Trigger reminder (stub)
          </button>
        </div>
        {selected ? (
          <p className="mt-2 text-xs text-ds-muted">
            Availability deadline: {selected.availability_deadline ?? "—"} · Missing submissions: {missing.length}
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-pulseShell-border bg-pulseShell-surface">
          <div className="border-b border-pulseShell-border px-4 py-3 text-sm font-semibold text-ds-foreground">
            Missing ({missing.length})
          </div>
          <ul className="divide-y divide-pulseShell-border">
            {missing.map((w) => (
              <li key={w.id} className="px-4 py-2 text-sm text-ds-foreground">
                {workerName(w)}
              </li>
            ))}
            {missing.length === 0 ? (
              <li className="px-4 py-6 text-sm text-ds-muted">All workers have submitted.</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-md border border-pulseShell-border bg-pulseShell-surface">
          <div className="border-b border-pulseShell-border px-4 py-3 text-sm font-semibold text-ds-foreground">
            Submitted ({rows.length})
          </div>
          <ul className="divide-y divide-pulseShell-border">
            {rows.map((r) => {
              const w = workers.find((x) => x.id === r.worker_id);
              return (
                <li key={r.id} className="px-4 py-2 text-sm text-ds-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{w ? workerName(w) : r.worker_id}</span>
                    <span className="shrink-0 text-xs text-ds-muted">{new Date(r.submitted_at).toLocaleString()}</span>
                  </div>
                </li>
              );
            })}
            {rows.length === 0 ? (
              <li className="px-4 py-6 text-sm text-ds-muted">No submissions yet.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

