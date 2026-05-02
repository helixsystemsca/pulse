"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { MOCK_PM_TASKS, POOL_SHUTDOWN_META } from "@/lib/pm-planning/mockPoolShutdown";
import { computePlanningCPMWithOverrides } from "@/lib/pm-planning/computePlanningCPM";
import { findResourceConflicts } from "@/lib/pm-planning/resourceConflicts";
import type { PmPlanningTab } from "@/lib/pm-planning/types";
import { PmCriticalPath } from "@/components/pm-planning/PmCriticalPath";
import { PmGantt } from "@/components/pm-planning/PmGantt";
import { PmNetworkDiagram } from "@/components/pm-planning/PmNetworkDiagram";
import { PmResourceView } from "@/components/pm-planning/PmResourceView";

/** Pool Shutdown demo + tabs — gated by `session.can_use_pm_features`. */
export function PmPlanningShell() {
  const { session } = usePulseAuth();
  const allowed = Boolean(session?.can_use_pm_features);

  const [tab, setTab] = useState<PmPlanningTab>("gantt");
  const [whatIf, setWhatIf] = useState(false);
  const [durationOverrides, setDurationOverrides] = useState<Record<string, number>>({});

  const tasks = MOCK_PM_TASKS;
  const meta = POOL_SHUTDOWN_META;

  const cpm = useMemo(
    () => computePlanningCPMWithOverrides(tasks, durationOverrides),
    [tasks, durationOverrides],
  );

  const conflicts = useMemo(() => findResourceConflicts(tasks, cpm), [tasks, cpm]);

  const maxFloat = useMemo(() => {
    let m = 0;
    for (const t of tasks) {
      const row = cpm.byId[t.id];
      const s = row?.slack;
      if (s !== undefined && !Number.isNaN(s) && !row?.isCritical) m = Math.max(m, s);
    }
    return m;
  }, [tasks, cpm]);

  const projectEnd = useMemo(() => {
    const d = new Date(meta.projectStart);
    d.setDate(d.getDate() + Math.ceil(cpm.projectDuration));
    return d;
  }, [meta.projectStart, cpm.projectDuration]);

  const modifiedCount = useMemo(() => {
    let n = 0;
    for (const k of Object.keys(durationOverrides)) {
      const base = tasks.find((t) => t.id === k)?.duration;
      if (base !== undefined && durationOverrides[k] !== base) n++;
    }
    return n;
  }, [durationOverrides, tasks]);

  const phases = useMemo(() => new Set(tasks.map((t) => t.category ?? "General")).size, [tasks]);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-ds-border bg-ds-primary p-6 text-center shadow-[var(--ds-shadow-card)]">
        <p className="text-sm text-ds-muted">PM planning requires the PM features flag on your account.</p>
      </div>
    );
  }

  const tabBtn = (id: PmPlanningTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`border-b-2 px-3 py-2 text-sm font-semibold transition ${
        tab === id
          ? "border-[var(--pm-color-primary)] text-ds-foreground"
          : "border-transparent text-[var(--pm-color-muted)] hover:text-ds-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 pb-8">
      <div className="h-1 w-full rounded-full bg-gradient-to-r from-[var(--ds-success)] via-[#3a7bd5] to-[var(--ds-danger)] opacity-90" />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ds-foreground">{meta.name}</h1>
          <p className="text-sm text-[var(--pm-color-muted)]">{meta.code}</p>
          <Link
            href="/dashboard/pm-workspace"
            className="mt-1 inline-block text-xs font-semibold text-[var(--pm-color-primary)] hover:underline"
          >
            Coordination workspace →
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWhatIf((w) => !w)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
              whatIf
                ? "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/35 dark:text-amber-100"
                : "border-ds-border bg-ds-primary text-ds-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            What-If
          </button>
          {whatIf ? (
            <button
              type="button"
              className="rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm font-semibold text-ds-foreground"
              onClick={() => setDurationOverrides({})}
            >
              Reset
            </button>
          ) : null}
          <span className="text-sm text-[var(--pm-color-muted)]">
            {meta.projectStart.toLocaleDateString()} — {projectEnd.toLocaleDateString()}
            {modifiedCount > 0 ? ` · ${modifiedCount} modified` : ""}
          </span>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--pm-color-critical)_18%,transparent)] px-3 py-1 text-xs font-bold text-[var(--pm-color-critical)]">
            {Math.ceil(cpm.projectDuration)}d Critical Path
          </span>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ds-border bg-[var(--ds-border)] md:grid-cols-4">
        {[
          ["Project duration", `${Math.ceil(cpm.projectDuration)}d`, `${Math.max(1, Math.round(cpm.projectDuration / 7))} weeks`],
          ["Total tasks", String(tasks.length), `${phases} phases`],
          ["Critical tasks", String(cpm.criticalPathTaskIds.length), "zero float"],
          ["Max float", `${maxFloat >= 1 ? Math.round(maxFloat) : maxFloat.toFixed(1)}d`, "slack available"],
        ].map(([a, b, c]) => (
          <div key={String(a)} className="bg-ds-primary px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--pm-color-muted)]">{a}</p>
            <p
              className={`text-2xl font-bold ${a === "Critical tasks" ? "text-[var(--pm-color-critical)]" : "text-ds-foreground"}`}
            >
              {b}
            </p>
            <p className="text-xs text-[var(--pm-color-muted)]">{c}</p>
          </div>
        ))}
      </section>

      {whatIf ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/25 dark:text-amber-100">
          ⚠ What-if mode — drag the right edge of a Gantt bar to adjust duration (scenario only).
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-1 border-b border-ds-border">
        {tabBtn("gantt", "Gantt / Schedule")}
        {tabBtn("network", "Network Diagram")}
        {tabBtn("resource", "Resource View")}
        {tabBtn("critical", "Critical Path")}
      </nav>

      {tab === "gantt" ? (
        <PmGantt
          tasks={tasks}
          cpm={cpm}
          projectStart={meta.projectStart}
          whatIfMode={whatIf}
          durationOverrides={durationOverrides}
          onDurationChange={(id, days) => setDurationOverrides((prev) => ({ ...prev, [id]: days }))}
        />
      ) : null}
      {tab === "network" ? <PmNetworkDiagram tasks={tasks} cpm={cpm} /> : null}
      {tab === "resource" ? (
        <PmResourceView tasks={tasks} cpm={cpm} projectStart={meta.projectStart} conflicts={conflicts} />
      ) : null}
      {tab === "critical" ? <PmCriticalPath tasks={tasks} cpm={cpm} projectStart={meta.projectStart} /> : null}
    </div>
  );
}
