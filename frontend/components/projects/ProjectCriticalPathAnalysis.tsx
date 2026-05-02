"use client";

import { useMemo } from "react";
import type { TaskRow } from "@/lib/projectsService";
import { computeCPM, normalizeTaskCategory, taskDurationDaysForCPM, TASK_CATEGORY_COLORS } from "@/lib/projects/cpm";

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function ProjectCriticalPathAnalysis({ tasks }: { tasks: TaskRow[] }) {
  const cpm = useMemo(() => computeCPM(tasks), [tasks]);

  const chainTitles = useMemo(() => {
    return cpm.criticalPathTaskIds.map((id) => tasks.find((t) => t.id === id)?.title ?? id);
  }, [cpm.criticalPathTaskIds, tasks]);

  const rows = useMemo(() => {
    return tasks
      .map((t) => ({ task: t, row: cpm.byId[t.id] }))
      .filter((x) => x.row)
      .sort((a, b) => a.row.es - b.row.es || a.task.title.localeCompare(b.task.title));
  }, [tasks, cpm.byId]);

  if (tasks.length === 0) {
    return <p className="text-sm text-ds-muted">No tasks — add tasks to run CPM.</p>;
  }

  return (
    <div className="space-y-6">
      {cpm.hasCycle ? (
        <p className="rounded-md border border-ds-warning/50 bg-ds-warning/10 px-3 py-2 text-sm font-medium text-ds-foreground">
          Task dependencies contain a cycle — CPM cannot be computed. Fix predecessor links and refresh.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-ds-border bg-ds-secondary/40 px-3 py-2 text-[10px] text-ds-muted">
        <span className="font-bold uppercase tracking-wide text-ds-foreground">Legend</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-6 rounded-sm ${TASK_CATEGORY_COLORS.planning}`} /> Planning
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-6 rounded-sm ${TASK_CATEGORY_COLORS.execution}`} /> Execution
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-6 rounded-sm ${TASK_CATEGORY_COLORS.cleanup}`} /> Cleanup
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-6 rounded-sm ${TASK_CATEGORY_COLORS.reflection}`} /> Reflection
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-6 rounded-sm border-2 border-red-500 bg-ds-gray-400" /> Critical
        </span>
      </div>

      <div className="rounded-md border border-ds-border bg-ds-secondary/30 px-4 py-3 text-sm text-ds-foreground">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Critical path</p>
        <p className="mt-1 font-semibold">
          {chainTitles.length > 0 ? (
            chainTitles.join(" → ")
          ) : (
            <span className="font-normal text-ds-muted">No critical tasks (all slack is positive).</span>
          )}
        </p>
        <p className="mt-2 text-xs text-ds-muted">
          Total duration (early finish horizon):{" "}
          <span className="font-semibold text-ds-foreground">{fmtNum(cpm.projectDuration)}</span> days
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-ds-border">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ds-border bg-ds-secondary/80 text-[10px] font-bold uppercase tracking-wide text-ds-muted">
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Duration (d)</th>
              <th className="px-3 py-2">ES</th>
              <th className="px-3 py-2">LS</th>
              <th className="px-3 py-2">Slack</th>
              <th className="px-3 py-2">Critical</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ task, row }) => {
              const cat = normalizeTaskCategory(task);
              return (
              <tr key={task.id} className="border-b border-ds-border/70 last:border-b-0">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2 font-semibold text-ds-foreground">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-sm ${TASK_CATEGORY_COLORS[cat]}`}
                      title={cat}
                      aria-hidden
                    />
                    <span className={row.isCritical ? "rounded-sm ring-2 ring-red-500 ring-offset-1 ring-offset-ds-primary" : ""}>
                      {task.title}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2 text-ds-muted">{fmtNum(taskDurationDaysForCPM(task))}</td>
                <td className="px-3 py-2 text-ds-muted">{fmtNum(row.es)}</td>
                <td className="px-3 py-2 text-ds-muted">{fmtNum(row.ls)}</td>
                <td className="px-3 py-2 text-ds-muted">{fmtNum(row.slack)}</td>
                <td className="px-3 py-2 font-semibold text-ds-foreground">{row.isCritical ? "Yes" : "No"}</td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      {chainTitles.length > 1 ? (
        <div className="rounded-md border border-ds-border bg-ds-secondary/20 px-3 py-2 text-xs text-ds-muted">
          <span className="font-semibold text-ds-foreground">Dependencies (critical chain):</span> {chainTitles.join(" → ")}
        </div>
      ) : null}
    </div>
  );
}
