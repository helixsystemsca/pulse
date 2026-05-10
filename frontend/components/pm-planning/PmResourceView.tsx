"use client";

import { useMemo } from "react";
import type { PmTask } from "@/lib/pm-planning/types";
import type { CPMResult } from "@/lib/projects/cpm";
import type { ResourceConflict } from "@/lib/pm-planning/resourceConflicts";
import { TimelineGrid } from "@/components/pm-planning/TimelineGrid";
import { ResourceRow } from "@/components/pm-planning/ResourceRow";

const PX = 28;

export function PmResourceView({
  tasks,
  cpm,
  projectStart,
  conflicts,
}: {
  tasks: PmTask[];
  cpm: CPMResult;
  projectStart: Date;
  conflicts: ResourceConflict[];
}) {
  const chartDays = Math.ceil(cpm.projectDuration) + 3;

  const rows = useMemo(() => {
    const m = new Map<string, PmTask[]>();
    for (const t of tasks) {
      const k = t.resource ?? "Unassigned";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tasks]);

  const conflictingTaskIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflicts) {
      s.add(c.taskA);
      s.add(c.taskB);
    }
    return s;
  }, [conflicts]);

  return (
    <div className="ds-premium-panel overflow-hidden">
      {conflicts.length === 0 ? (
        <div className="flex items-center gap-2 border-b border-[var(--ds-border)] bg-[color-mix(in_srgb,var(--pm-color-primary)_12%,transparent)] px-4 py-2 text-sm font-medium text-[var(--ds-text-primary)]">
          <span aria-hidden>✓</span>
          No resource conflicts — all assignments are clear.
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b border-[var(--ds-border)] bg-[color-mix(in_srgb,var(--pm-color-critical)_14%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--pm-color-critical)]">
          <span aria-hidden>⚠</span>
          Overlapping assignments on {conflicts.length} pair(s) — see highlighted blocks.
        </div>
      )}
      <div className="flex max-h-[560px] min-h-[320px] flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="w-52 shrink-0 border-r border-[var(--ds-border)] bg-[var(--ds-header)]" />
          <div className="min-w-0 flex-1 overflow-x-auto">
            <TimelineGrid days={chartDays} pxPerDay={PX} projectStart={projectStart} />
          </div>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {rows.map(([name, list]) => (
            <ResourceRow
              key={name}
              resourceName={name}
              tasks={list}
              cpm={cpm}
              pxPerDay={PX}
              chartDays={chartDays}
              conflictingTaskIds={conflictingTaskIds}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
