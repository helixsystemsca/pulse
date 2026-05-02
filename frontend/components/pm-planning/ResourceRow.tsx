"use client";

import type { PmTask } from "@/lib/pm-planning/types";
import type { CPMResult } from "@/lib/projects/cpm";
import { resourceBarClass } from "@/lib/pm-planning/resourcePalette";

export function ResourceRow({
  resourceName,
  tasks,
  cpm,
  pxPerDay,
  chartDays,
  conflictingTaskIds,
}: {
  resourceName: string;
  tasks: PmTask[];
  cpm: CPMResult;
  pxPerDay: number;
  chartDays: number;
  conflictingTaskIds: Set<string>;
}) {
  const totalPx = chartDays * pxPerDay;
  const tint = resourceBarClass(tasks[0]?.resource ?? resourceName);

  return (
    <div className="flex h-11 border-b border-[var(--ds-border)]">
      <div className="flex w-52 shrink-0 items-center gap-2 border-r border-[var(--ds-border)] bg-[var(--ds-surface-primary)] px-2 text-[13px] font-semibold text-[var(--ds-text-primary)]">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tint}`} aria-hidden />
        <span className="truncate">{resourceName}</span>
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden bg-[var(--ds-surface-secondary)]">
        <div className="relative h-full" style={{ width: totalPx }}>
          {tasks.map((t) => {
            const row = cpm.byId[t.id];
            if (!row) return null;
            const left = row.es * pxPerDay;
            const w = Math.max((row.ef - row.es) * pxPerDay, 10);
            const hasConflict = conflictingTaskIds.has(t.id);
            return (
              <div
                key={t.id}
                title={`${t.name} (${t.id})`}
                className={`absolute top-1.5 flex h-8 items-center justify-center rounded px-1 text-[10px] font-bold text-white shadow-sm ${tint} ${
                  hasConflict ? "ring-2 ring-[var(--pm-color-critical)] ring-offset-1" : ""
                }`}
                style={{ left, width: w }}
              >
                {t.id}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
