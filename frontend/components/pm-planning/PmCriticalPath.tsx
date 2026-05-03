"use client";

import type { PmTask } from "@/lib/pm-planning/types";
import type { CPMResult } from "@/lib/projects/cpm";

function categoryStyle(cat?: string): string {
  const c = (cat ?? "OTHER").toUpperCase();
  const map: Record<string, string> = {
    DECOMMISSION: "bg-pink-100 text-pink-900 dark:bg-pink-950/40 dark:text-pink-100",
    INSPECTION: "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
    DEMOLITION: "bg-orange-100 text-orange-950 dark:bg-orange-950/40 dark:text-orange-100",
    REPAIR: "bg-purple-100 text-purple-950 dark:bg-purple-950/40 dark:text-purple-100",
    RESURFACE: "bg-teal-100 text-teal-950 dark:bg-teal-950/40 dark:text-teal-100",
    RECOMMISSION: "bg-blue-100 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100",
    CLOSEOUT: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
  };
  return map[c] ?? "bg-[var(--ds-surface-secondary)] text-[var(--ds-text-primary)]";
}

export function PmCriticalPath({
  tasks,
  cpm,
  projectStart,
}: {
  tasks: PmTask[];
  cpm: CPMResult;
  projectStart: Date;
}) {
  const ordered = cpm.criticalPathTaskIds.map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as PmTask[];

  const wallDay = (offset: number) => {
    const d = new Date(projectStart);
    d.setDate(d.getDate() + Math.floor(offset));
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-primary)] shadow-[var(--ds-shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--pm-color-critical)]" aria-hidden />
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            Critical Path — {ordered.length} tasks
          </h3>
        </div>
        <span className="text-sm font-semibold text-[var(--pm-color-muted)]">
          Project duration ~{Math.ceil(cpm.projectDuration)}d
        </span>
      </div>
      <ul className="divide-y divide-[var(--ds-border)]">
        {ordered.map((t, idx) => {
          const row = cpm.byId[t.id];
          if (!row) return null;
          return (
            <li key={t.id} className="flex items-start gap-3 px-4 py-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-[var(--pm-color-critical)] px-0.5 font-mono text-[11px] font-bold tabular-nums text-[var(--ds-text-primary)]"
                title={t.id}
              >
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--ds-text-primary)]">{t.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                  {t.category ? (
                    <span className={`rounded-full px-2 py-0.5 font-bold uppercase ${categoryStyle(t.category)}`}>
                      {t.category}
                    </span>
                  ) : null}
                  <span className="text-[var(--pm-color-muted)]">
                    {wallDay(row.es)} – {wallDay(row.ef - 0.01)} · {t.duration}d
                  </span>
                  {t.resource ? (
                    <span className="rounded bg-[var(--ds-surface-secondary)] px-1.5 py-0.5 text-[var(--ds-text-primary)]">
                      {t.resource}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
