"use client";

import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { apiFetch } from "@/lib/api";
import { listProjects, type ProjectRow } from "@/lib/projectsService";
import type { PulseWorkerApi } from "@/lib/schedule/pulse-bridge";

function initials(name: string | null | undefined, email: string): string {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    return p[0].slice(0, 2).toUpperCase();
  }
  return email.split("@")[0]?.slice(0, 2).toUpperCase() || "?";
}

function statusStyle(st: string): string {
  if (st === "completed") return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80";
  if (st === "on_hold") return "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80";
  return "bg-sky-50 text-[#2B4C7E] ring-1 ring-sky-200/80";
}

function statusLabel(st: string): string {
  if (st === "on_hold") return "On Hold";
  if (st === "completed") return "Completed";
  return "Active";
}

export function ProjectsApp() {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [workers, setWorkers] = useState<PulseWorkerApi[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await listProjects();
        if (!cancel) setRows(data);
      } catch {
        if (!cancel) setErr("Could not load projects.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const w = await apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers");
        setWorkers(w);
      } catch {
        setWorkers([]);
      }
    })();
  }, []);

  if (err) {
    return <p className="text-sm font-medium text-red-700">{err}</p>;
  }
  if (rows === null) {
    return (
      <div className="flex min-h-[32vh] items-center justify-center text-sm text-pulse-muted">Loading projects…</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-pulse-navy">Projects</h1>
          <p className="mt-1 text-sm text-pulse-muted">Track initiatives, tasks, and calendar-linked due dates.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card padding="md">
          <p className="text-sm text-pulse-muted">No projects yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group block no-underline">
              <Card padding="md" className="h-full transition-colors group-hover:border-pulse-accent/40">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-pulse-accent">
                    <FolderKanban className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-headline text-base font-semibold text-pulse-navy group-hover:text-pulse-accent">
                      {p.name}
                    </p>
                    <p className="mt-1 text-xs text-pulse-muted">
                      {p.start_date} → {p.end_date}
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle(p.status)}`}
                    >
                      {statusLabel(p.status)}
                    </span>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-pulse-muted">
                        <span>Progress</span>
                        <span className="tabular-nums text-pulse-navy">{p.progress_pct}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-pulse-accent transition-[width] duration-300"
                          style={{ width: `${p.progress_pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-pulse-muted">
                        {p.task_completed} / {p.task_total} tasks complete
                      </p>
                      {(p.assignee_user_ids?.length ?? 0) > 0 ? (
                        <div className="mt-3 flex items-center gap-1" title="Assigned across tasks">
                          {(p.assignee_user_ids ?? []).slice(0, 5).map((uid) => {
                            const w = workerById.get(uid);
                            return (
                              <span
                                key={uid}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10px] font-bold text-pulse-navy ring-1 ring-slate-200 first:ml-0 -ml-1.5"
                              >
                                {initials(w?.full_name ?? null, w?.email ?? "")}
                              </span>
                            );
                          })}
                          {(p.assignee_user_ids ?? []).length > 5 ? (
                            <span className="pl-1 text-[11px] font-semibold text-pulse-muted">
                              +{(p.assignee_user_ids ?? []).length - 5}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
