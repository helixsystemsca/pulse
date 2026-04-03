"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/pulse/Card";
import {
  getOperationsAccountability,
  getOperationsInsights,
  type MissedProximityEventRow,
  type OperationsAccountability,
  type OperationsInsights,
  type TaskHealthItemRow,
  type UserPerformanceInsightRow,
} from "@/lib/projectsService";

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";
const FIELD_TW =
  "rounded-[10px] border border-slate-200/90 bg-white px-3 py-2 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25";

function priorityBadge(p: string): string {
  if (p === "critical") return "bg-red-50 text-red-900 ring-1 ring-red-200/80";
  if (p === "high") return "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80";
  if (p === "low") return "bg-slate-100 text-pulse-muted ring-1 ring-slate-200/80";
  return "bg-sky-50 text-[#2B4C7E] ring-1 ring-sky-200/80";
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80";
  if (score >= 50) return "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80";
  return "bg-red-50 text-red-900 ring-1 ring-red-200/80";
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function userLabel(m: MissedProximityEventRow): string {
  if (m.user_full_name?.trim()) return m.user_full_name.trim();
  if (m.user_email?.trim()) return m.user_email.trim();
  return m.user_id;
}

function windowLabel(tw: string): string {
  if (tw === "7d") return "last 7 days";
  if (tw === "30d") return "last 30 days";
  return "last 24 hours";
}

export function OperationsApp() {
  const [data, setData] = useState<OperationsAccountability | null>(null);
  const [insights, setInsights] = useState<OperationsInsights | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState("24h");

  const load = useCallback(async () => {
    try {
      const [acc, ins] = await Promise.all([
        getOperationsAccountability(),
        getOperationsInsights(timeWindow),
      ]);
      setData(acc);
      setInsights(ins);
      setErr(null);
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status;
      if (status === 403) {
        setErr("You need manager access to view operations.");
      } else {
        setErr("Could not load operations data.");
      }
      setData(null);
      setInsights(null);
    }
  }, [timeWindow]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) {
    return (
      <div className="space-y-4">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-pulse-navy">Operations</h1>
        <p className="text-sm font-medium text-red-700">{err}</p>
        <button type="button" className={PRIMARY_BTN} onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!data || !insights) {
    return (
      <div className="space-y-4">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-pulse-navy">Operations</h1>
        <p className="text-sm text-pulse-muted">Loading…</p>
      </div>
    );
  }

  const s = insights.summary;
  const twLabel = windowLabel(insights.time_window);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-pulse-navy">Operations</h1>
          <p className="mt-1 text-sm text-pulse-muted">
            Performance, bottlenecks, and accountability across your organization. Insight metrics use the selected window (
            {twLabel}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="ops-time-window">
            Time window
          </label>
          <select
            id="ops-time-window"
            className={FIELD_TW}
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value)}
          >
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
          </select>
          <button type="button" className={PRIMARY_BTN} onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card padding="md" className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">Missed events</p>
          <p className="font-headline text-2xl font-bold tabular-nums text-pulse-navy">{s.total_missed_events}</p>
          <p className="text-xs text-pulse-muted">Proximity opportunities missed ({twLabel})</p>
        </Card>
        <Card padding="md" className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">Overdue tasks</p>
          <p className="font-headline text-2xl font-bold tabular-nums text-pulse-navy">{s.total_overdue_tasks}</p>
          <p className="text-xs text-pulse-muted">Open work past due (current)</p>
        </Card>
        <Card padding="md" className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">Avg responsiveness</p>
          <p className="font-headline text-2xl font-bold tabular-nums text-pulse-navy">{s.avg_responsiveness_score}</p>
          <p className="text-xs text-pulse-muted">Mean score (0–100, {twLabel})</p>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-pulse-muted">Worker performance</h2>
        <p className="text-xs text-pulse-muted">
          Lowest responsiveness scores first. Responsiveness blends missed proximity and response time; reliability penalizes overdue
          and stale assigned work.
        </p>
        <WorkerPerformanceTable rows={insights.user_performance} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-pulse-muted">Bottlenecks</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-pulse-muted">By location</h3>
            <LocationBottleneckTable rows={insights.location_bottlenecks} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-pulse-muted">By project</h3>
            <ProjectBottleneckTable rows={insights.project_bottlenecks} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-pulse-muted">Missed opportunities</h2>
        <p className="text-xs text-pulse-muted">
          Proximity prompts that were not acted on within the grace window (after supervisors open this view, pending events are
          evaluated).
        </p>
        {data.missed_proximity.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-pulse-muted">No missed proximity events recorded.</p>
          </Card>
        ) : (
          <Card padding="md" className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Equipment</th>
                  <th className="px-3 py-2">Tasks</th>
                  <th className="px-3 py-2">Detected</th>
                </tr>
              </thead>
              <tbody>
                {data.missed_proximity.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-3 text-pulse-navy">{userLabel(m)}</td>
                    <td className="px-3 py-3 text-pulse-muted">
                      {m.equipment_label?.trim() ? m.equipment_label : m.location_tag_id}
                    </td>
                    <td className="px-3 py-3 text-pulse-muted">
                      {m.task_titles.length ? m.task_titles.join(", ") : m.tasks_present.join(", ") || "—"}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-pulse-muted">{formatWhen(m.detected_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-pulse-muted">Overdue tasks</h2>
        {data.overdue_tasks.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-pulse-muted">No overdue tasks.</p>
          </Card>
        ) : (
          <HealthTaskTable rows={data.overdue_tasks} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-pulse-muted">At-risk tasks</h2>
        <p className="text-xs text-pulse-muted">Tasks that are blocked, stale (no update in 24h), or overdue.</p>
        {data.at_risk_tasks.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-pulse-muted">No at-risk tasks.</p>
          </Card>
        ) : (
          <HealthTaskTable rows={data.at_risk_tasks} showRisk />
        )}
      </section>
    </div>
  );
}

function WorkerPerformanceTable({ rows }: { rows: UserPerformanceInsightRow[] }) {
  if (rows.length === 0) {
    return (
      <Card padding="md">
        <p className="text-sm text-pulse-muted">No users in this organization.</p>
      </Card>
    );
  }
  return (
    <Card padding="md" className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">
            <th className="px-3 py-2">User</th>
            <th className="px-3 py-2">Responsiveness</th>
            <th className="px-3 py-2">Reliability</th>
            <th className="px-3 py-2">Tasks completed</th>
            <th className="px-3 py-2">Missed events</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.user_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-3 font-medium text-pulse-navy">{u.name}</td>
              <td className="px-3 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tabular-nums ${scoreBadgeClass(u.responsiveness_score)}`}
                >
                  {u.responsiveness_score}
                </span>
              </td>
              <td className="px-3 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tabular-nums ${scoreBadgeClass(u.reliability_score)}`}
                >
                  {u.reliability_score}
                </span>
              </td>
              <td className="px-3 py-3 tabular-nums text-pulse-muted">{u.tasks_completed}</td>
              <td className="px-3 py-3 tabular-nums text-pulse-muted">{u.missed_proximity_events}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function LocationBottleneckTable({
  rows,
}: {
  rows: OperationsInsights["location_bottlenecks"];
}) {
  if (rows.length === 0) {
    return (
      <Card padding="md">
        <p className="text-sm text-pulse-muted">No location-level signals in this window.</p>
      </Card>
    );
  }
  return (
    <Card padding="md" className="overflow-x-auto">
      <table className="w-full min-w-[20rem] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">
            <th className="px-3 py-2">Equipment</th>
            <th className="px-3 py-2">Missed</th>
            <th className="px-3 py-2">Overdue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.location_tag_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-3 text-pulse-navy">{r.equipment_label?.trim() ? r.equipment_label : r.location_tag_id}</td>
              <td className="px-3 py-3 tabular-nums text-pulse-muted">{r.missed_events_count}</td>
              <td className="px-3 py-3 tabular-nums text-pulse-muted">{r.overdue_tasks_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ProjectBottleneckTable({ rows }: { rows: OperationsInsights["project_bottlenecks"] }) {
  if (rows.length === 0) {
    return (
      <Card padding="md">
        <p className="text-sm text-pulse-muted">No project-level backlog signals.</p>
      </Card>
    );
  }
  return (
    <Card padding="md" className="overflow-x-auto">
      <table className="w-full min-w-[20rem] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2">Overdue</th>
            <th className="px-3 py-2">Blocked</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.project_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-3">
                <Link href={`/projects/${r.project_id}`} className="font-medium text-pulse-navy hover:text-pulse-accent">
                  {r.project_name?.trim() ? r.project_name : r.project_id}
                </Link>
              </td>
              <td className="px-3 py-3 tabular-nums text-pulse-muted">{r.overdue_tasks}</td>
              <td className="px-3 py-3 tabular-nums text-pulse-muted">{r.blocked_tasks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function HealthTaskTable({ rows, showRisk }: { rows: TaskHealthItemRow[]; showRisk?: boolean }) {
  return (
    <Card padding="md" className="overflow-x-auto">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">
            <th className="px-3 py-2">Task</th>
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Due</th>
            {showRisk ? <th className="px-3 py-2">Signals</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-3">
                <Link href={`/projects/${t.project_id}`} className="font-medium text-pulse-navy hover:text-pulse-accent">
                  {t.title}
                </Link>
              </td>
              <td className="px-3 py-3 text-pulse-muted">{t.project_name?.trim() ? t.project_name : "—"}</td>
              <td className="px-3 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityBadge(t.priority)}`}
                >
                  {t.priority}
                </span>
              </td>
              <td className="px-3 py-3 text-pulse-muted capitalize">{t.status.replace("_", " ")}</td>
              <td className="px-3 py-3 tabular-nums text-pulse-muted">{t.due_date ?? "—"}</td>
              {showRisk ? (
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {t.is_overdue ? (
                      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-900 ring-1 ring-red-200/80">
                        Overdue
                      </span>
                    ) : null}
                    {t.is_stale ? (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950 ring-1 ring-amber-200/80">
                        Stale
                      </span>
                    ) : null}
                    {t.is_blocked ? (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-pulse-muted ring-1 ring-slate-200/80">
                        Blocked
                      </span>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
