"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlannerChrome } from "@/components/planner/PlannerChrome";
import {
  DELAY_REASON_LABELS,
  downloadAnalyticsCsv,
  fetchAnalytics,
  type PlannerAnalytics,
} from "@/lib/planner/plannerService";

const btnGhost = "rounded-lg border border-ds-border px-3 py-1.5 text-sm text-ds-foreground hover:bg-ds-card";

function asRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number") out[k] = v;
  }
  return out;
}

export default function PlannerAnalyticsPage() {
  const [range, setRange] = useState<"week" | "month" | "quarter" | "year">("week");
  const [data, setData] = useState<PlannerAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchAnalytics(range));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    }
  }, [range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const delayReasons = asRecord(data?.delays && typeof data.delays === "object" ? (data.delays as { by_reason?: unknown }).by_reason : {});
  const interruptReasons = asRecord(
    data?.interruptions && typeof data.interruptions === "object" ? (data.interruptions as { by_reason?: unknown }).by_reason : {},
  );
  const blockerTypes = asRecord(data?.blockers && typeof data.blockers === "object" ? (data.blockers as { by_type?: unknown }).by_type : {});
  const prev = (data?.comparison?.previous ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planner Analytics"
        description="Where time went — not a productivity score. Insights are generated only from stored planner data."
        icon={Activity}
        actions={
          <div className="flex flex-wrap gap-2">
            {(["week", "month", "quarter", "year"] as const).map((r) => (
              <button key={r} type="button" className={range === r ? "rounded-lg bg-ds-primary px-3 py-1.5 text-sm text-white" : btnGhost} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
            <button type="button" className={btnGhost} onClick={() => void downloadAnalyticsCsv(range)}>
              CSV / Excel
            </button>
          </div>
        }
      />
      <PageBody>
        <PlannerChrome />
        {error ? <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        {!data ? (
          <p className="text-sm text-ds-muted">Loading…</p>
        ) : (
          <>
            <p className="text-sm text-ds-muted">{data.range_label}</p>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">Productivity</h2>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(data.productivity).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-ds-border bg-ds-card p-3">
                    <p className="text-xs uppercase tracking-wide text-ds-muted">{k.replace(/_/g, " ")}</p>
                    <p className="text-2xl font-semibold text-ds-foreground">{v}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">Time allocation</h2>
              <ul className="mt-2 space-y-1">
                {Object.entries(data.time_allocation).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between rounded-lg border border-ds-border px-3 py-2 text-sm">
                    <span className="capitalize">{k.replace(/_/g, " ")}</span>
                    <span>{v}%</span>
                  </li>
                ))}
                {Object.keys(data.time_allocation).length === 0 ? <li className="text-sm text-ds-muted">No scheduled time in this range yet.</li> : null}
              </ul>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-ds-border bg-ds-card p-4">
                <h3 className="text-sm font-semibold">Interruptions</h3>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-ds-muted">{JSON.stringify(data.interruptions, null, 2)}</pre>
                {Object.entries(interruptReasons).map(([k, v]) => (
                  <p key={k} className="text-sm">
                    {DELAY_REASON_LABELS[k] ?? k}: {v}
                  </p>
                ))}
              </div>
              <div className="rounded-xl border border-ds-border bg-ds-card p-4">
                <h3 className="text-sm font-semibold">Delays</h3>
                <p className="mt-1 text-sm text-ds-muted">Healthy delays (emergency / higher-priority / operational) are not treated as poor performance.</p>
                {Object.entries(delayReasons).map(([k, v]) => (
                  <p key={k} className="text-sm">
                    {DELAY_REASON_LABELS[k] ?? k}: {v}
                  </p>
                ))}
                <p className="mt-2 text-sm">Healthy: {String((data.delays as { healthy?: number }).healthy ?? 0)}</p>
                <p className="text-sm">Process: {String((data.delays as { process?: number }).process ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-ds-border bg-ds-card p-4">
                <h3 className="text-sm font-semibold">Blockers</h3>
                {Object.entries(blockerTypes).map(([k, v]) => (
                  <p key={k} className="text-sm">
                    {k}: {v}
                  </p>
                ))}
                {Object.keys(blockerTypes).length === 0 ? <p className="text-sm text-ds-muted">No blockers in this range.</p> : null}
              </div>
            </section>

            <section className="rounded-xl border border-ds-border bg-ds-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">Comparison vs previous period</h2>
              {Object.keys(prev).length === 0 ? (
                <p className="mt-2 text-sm text-ds-muted">Not enough prior data to compare.</p>
              ) : (
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {["completion_pct", "delayed", "interruption_minutes", "meeting_minutes"].map((k) => (
                    <li key={k} className="text-sm">
                      {k.replace(/_/g, " ")}: {String(prev[k] ?? "—")} → {String(data.productivity[k] ?? data.interruptions[k as never] ?? "—")}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-ds-border bg-ds-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">Management insights</h2>
              {data.insights.length === 0 ? (
                <p className="mt-2 text-sm text-ds-muted">No insights yet — they appear once the planner has stored completions, delays, or interruptions.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {data.insights.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-ds-border bg-ds-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">Operational performance</h2>
              <p className="mt-1 text-sm text-ds-muted">
                Reliability, compliance, asset, project, financial, and people metrics will connect to those modules in a later phase. This view uses planner time only.
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                <li>Reactive interruptions: {String((data.interruptions as { total_minutes?: number }).total_minutes ?? 0)} min</li>
                <li>Meetings: {data.productivity.meeting_minutes ?? 0} min</li>
                <li>Strategic / improvement: {data.productivity.strategic_minutes ?? 0} min</li>
                <li>On-time completion: {data.productivity.on_time_pct ?? 0}%</li>
              </ul>
            </section>
          </>
        )}
      </PageBody>
    </div>
  );
}
