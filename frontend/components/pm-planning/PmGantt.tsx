"use client";

import { useEffect, useMemo, useState } from "react";
import type { PmTask } from "@/lib/pm-planning/types";
import type { CPMResult } from "@/lib/projects/cpm";
import { resourceBarClass } from "@/lib/pm-planning/resourcePalette";
import { TaskBar } from "@/components/pm-planning/TaskBar";
import { TimelineGrid } from "@/components/pm-planning/TimelineGrid";

const PX_PER_DAY = 28;

export function PmGantt({
  tasks,
  cpm,
  projectStart,
  whatIfMode,
  durationOverrides,
  onDurationChange,
  onTaskLabelClick,
}: {
  tasks: PmTask[];
  cpm: CPMResult;
  projectStart: Date;
  whatIfMode: boolean;
  durationOverrides: Record<string, number>;
  onDurationChange: (taskId: string, days: number) => void;
  /** When set (e.g. embedded project planning), clicking the task name opens the task editor. */
  onTaskLabelClick?: (taskId: string) => void;
}) {
  const chartDays = Math.ceil(cpm.projectDuration) + 3;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resize, setResize] = useState<{ id: string; startX: number; startDur: number } | null>(null);

  const effectiveDuration = (t: PmTask) => durationOverrides[t.id] ?? t.duration;

  useEffect(() => {
    if (!resize) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - resize.startX;
      const dd = dx / PX_PER_DAY;
      const next = Math.max(0.25, Math.round((resize.startDur + dd) * 4) / 4);
      onDurationChange(resize.id, next);
    };
    const onUp = () => setResize(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resize, onDurationChange]);

  const totalPx = chartDays * PX_PER_DAY;

  const rows = useMemo(() => tasks.map((t) => ({ t, row: cpm.byId[t.id] })), [tasks, cpm]);

  return (
    <div className="flex min-h-[420px] flex-col rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-primary)] shadow-[var(--ds-shadow-card)]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-72 shrink-0 overflow-y-auto border-r border-[var(--ds-border)] bg-[var(--ds-surface-primary)]">
          <div className="sticky top-0 z-10 h-9 border-b border-[var(--ds-border)] bg-[var(--ds-header)]" />
          {rows.map(({ t, row }, idx) => {
            if (!row) return null;
            const slack = row.slack;
            const isCrit = row.isCritical;
            const lowFloat = !isCrit && slack > 0 && slack <= 2 && !Number.isNaN(slack);
            let floatLabel = "";
            if (isCrit) floatLabel = "CRITICAL";
            else if (!Number.isNaN(slack)) floatLabel = `+${slack >= 1 ? Math.round(slack) : slack.toFixed(1)}d`;
            return (
              <div
                key={t.id}
                className={`flex h-[38px] items-center border-b border-[var(--ds-border)] px-2 text-[12px] ${
                  idx % 2 === 0 ? "bg-[var(--ds-surface-primary)]" : "bg-[var(--ds-surface-secondary)]"
                }`}
              >
                {onTaskLabelClick ? (
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer truncate text-left font-medium text-[var(--ds-text-primary)] hover:underline"
                    title={t.name}
                    onClick={() => onTaskLabelClick(t.id)}
                  >
                    {t.name}
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--ds-text-primary)]" title={t.name}>
                    {t.name}
                  </span>
                )}
                <span
                  className={`ml-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    isCrit
                      ? "bg-[color-mix(in_srgb,var(--pm-color-critical)_18%,transparent)] text-[var(--pm-color-critical)]"
                      : lowFloat
                        ? "bg-[color-mix(in_srgb,var(--pm-low-float)_22%,transparent)] text-amber-900 dark:text-amber-100"
                        : "bg-[color-mix(in_srgb,var(--pm-color-primary)_14%,transparent)] text-[var(--ds-text-primary)]"
                  }`}
                >
                  {floatLabel}
                </span>
              </div>
            );
          })}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-auto">
          <div style={{ width: totalPx, minWidth: totalPx }}>
            <TimelineGrid days={chartDays} pxPerDay={PX_PER_DAY} projectStart={projectStart} />
            {rows.map(({ t, row }, idx) => {
              if (!row) return null;
              const effDur = effectiveDuration(t);
              const barW = effDur * PX_PER_DAY;
              const es = row.es;
              const slack = row.slack;
              const floatW = !row.isCritical && !Number.isNaN(slack) && slack > 0 ? slack * PX_PER_DAY : 0;
              const left = es * PX_PER_DAY;
              const isCrit = row.isCritical;
              const lowFloat = !isCrit && slack > 0 && slack <= 2 && !Number.isNaN(slack);
              return (
                <div
                  key={t.id}
                  className={`relative h-[38px] border-b border-[var(--ds-chart-grid)] ${
                    idx % 2 === 0 ? "bg-[var(--ds-surface-primary)]" : "bg-[var(--ds-surface-secondary)]"
                  }`}
                >
                  <div
                    className="absolute top-1/2 flex -translate-y-1/2 items-center"
                    style={{ left, width: barW + floatW + 4 }}
                  >
                    <TaskBar
                      taskId={t.id}
                      title={t.name}
                      durationDays={effDur}
                      barWidthPx={barW}
                      floatWidthPx={floatW}
                      isCritical={isCrit}
                      lowFloat={lowFloat}
                      resourceTintClass={isCrit ? "bg-[var(--pm-color-critical)]" : resourceBarClass(t.resource)}
                      selected={selectedId === t.id}
                      whatIfMode={whatIfMode}
                      onSelect={() => setSelectedId(t.id)}
                      onResizePointerDown={
                        whatIfMode
                          ? (e) => {
                              setResize({
                                id: t.id,
                                startX: e.clientX,
                                startDur: effDur,
                              });
                            }
                          : undefined
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
