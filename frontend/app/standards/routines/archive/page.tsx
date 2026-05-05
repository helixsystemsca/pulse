"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/pulse/Card";
import { apiFetch } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type RunRow = {
  id: string;
  routine_id: string;
  routine_assignment_id?: string | null;
  user_id?: string | null;
  shift_id?: string | null;
  started_at: string;
  completed_at?: string | null;
  status: "completed" | "in_progress";
};

type RoutineRow = { id: string; name: string };

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-ds-border bg-ds-secondary px-3 py-2.5 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const SECONDARY_BTN = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5");

function isoDateOnly(ts: string | null | undefined): string {
  if (!ts) return "";
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toISOString().slice(0, 10);
}

export default function RoutineArchivePage() {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [routines, setRoutines] = useState<RoutineRow[] | null>(null);
  const routineMap = useMemo(() => new Map((routines ?? []).map((r) => [r.id, r.name])), [routines]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [routineId, setRoutineId] = useState("");
  const [hasMissed, setHasMissed] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const sp = new URLSearchParams();
      if (routineId) sp.set("routine_id", routineId);
      if (fromDate) sp.set("from", `${fromDate}T00:00:00.000Z`);
      if (toDate) sp.set("to", `${toDate}T23:59:59.999Z`);
      if (hasMissed) sp.set("has_missed_items", "true");
      const q = sp.toString();

      const [r, list] = await Promise.all([
        apiFetch<Array<{ id: string; name: string }>>("/api/v1/routines"),
        apiFetch<RunRow[]>(`/api/v1/routines/runs${q ? `?${q}` : ""}`),
      ]);
      setRoutines(r);
      setRuns(list);
    } catch (e) {
      const { message } = parseClientApiError(e);
      setErr(message || "Could not load archive.");
      setRuns([]);
      setRoutines([]);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, routineId, hasMissed]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ds-foreground">Routine archive</p>
          <p className="mt-1 text-sm text-ds-muted">Completed runs for reporting and audit trail.</p>
        </div>
        <Link className={SECONDARY_BTN} href="/standards/routines">
          Back to routines
        </Link>
      </div>

      {err ? (
        <div className="rounded-xl border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-danger shadow-sm">
          {err}
        </div>
      ) : null}

      <Card padding="md" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={LABEL} htmlFor="ra-from">
              From
            </label>
            <input id="ra-from" type="date" className={FIELD} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="ra-to">
              To
            </label>
            <input id="ra-to" type="date" className={FIELD} value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="ra-routine">
              Routine
            </label>
            <select id="ra-routine" className={FIELD} value={routineId} onChange={(e) => setRoutineId(e.target.value)}>
              <option value="">All routines</option>
              {(routines ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ds-foreground">
              <input type="checkbox" checked={hasMissed} onChange={(e) => setHasMissed(e.target.checked)} />
              Has missed items
            </label>
          </div>
        </div>
      </Card>

      {runs === null ? (
        <p className="text-sm text-ds-muted">Loading…</p>
      ) : runs.length === 0 ? (
        <Card padding="md" className="border-dashed border-slate-200/90 dark:border-ds-border">
          <p className="text-sm text-ds-muted">No routine runs yet.</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-ds-border">
            {runs.map((rr) => (
              <Link key={rr.id} href={`/standards/routines/archive/${rr.id}`} className="block px-4 py-3 hover:bg-ds-interactive-hover">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ds-foreground">
                      {routineMap.get(rr.routine_id) ?? rr.routine_id}
                    </p>
                    <p className="mt-0.5 text-xs text-ds-muted">
                      {isoDateOnly(rr.completed_at || rr.started_at)}
                      {rr.shift_id ? ` · shift ${rr.shift_id}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-ds-border bg-ds-secondary px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-ds-muted">
                    {rr.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

