"use client";

import type { PmTask } from "@/lib/pm-planning/types";
import { formatPmTaskChipId } from "@/lib/pm-planning/taskDisplayLabel";

export function NodeCard({
  task,
  isCritical,
  floatLabel,
  onClick,
}: {
  task: PmTask;
  isCritical: boolean;
  floatLabel: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ds-card-primary flex h-full w-full flex-col rounded-lg border-2 px-2 py-1.5 text-left ${
        isCritical ? "border-[var(--pm-color-critical)]" : "border-[var(--ds-border)]"
      } `}
    >
      <div className="mb-0.5 flex items-start justify-between gap-1.5">
        <span
          className="max-w-[3.5rem] truncate rounded bg-[var(--ds-surface-secondary)] px-1 py-0.5 font-mono text-[10px] font-bold text-[var(--ds-text-primary)]"
          title={task.id}
        >
          {formatPmTaskChipId(task.id)}
        </span>
        <span
          className={`shrink-0 text-[9px] font-bold uppercase ${
            isCritical ? "text-[var(--pm-color-critical)]" : "text-[var(--pm-color-primary)]"
          }`}
        >
          {isCritical ? "CRIT" : floatLabel}
        </span>
      </div>
      <p className="line-clamp-2 min-h-0 flex-1 text-[11px] font-semibold leading-tight text-[var(--ds-text-primary)]">
        {task.name}
      </p>
      <div className="mt-auto flex items-center justify-between gap-1 border-t border-[var(--ds-border)]/60 pt-1 text-[10px] text-[var(--pm-color-muted)]">
        <span className="tabular-nums">{task.duration}d</span>
        {task.resource ? <span className="min-w-0 truncate">{task.resource}</span> : null}
      </div>
    </button>
  );
}
