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
      className={`flex h-full w-full flex-col rounded-xl border-2 bg-[var(--ds-surface-primary)] p-2.5 text-left shadow-[var(--ds-shadow-card)] transition hover:shadow-[var(--ds-shadow-card-hover)] ${
        isCritical ? "border-[var(--pm-color-critical)]" : "border-[var(--ds-border)]"
      } `}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <span
          className="max-w-[4.5rem] truncate rounded bg-[var(--ds-surface-secondary)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--ds-text-primary)]"
          title={task.id}
        >
          {formatPmTaskChipId(task.id)}
        </span>
        <span
          className={`text-[10px] font-bold uppercase ${
            isCritical ? "text-[var(--pm-color-critical)]" : "text-[var(--pm-color-primary)]"
          }`}
        >
          {isCritical ? "CRIT" : floatLabel}
        </span>
      </div>
      <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--ds-text-primary)]">{task.name}</p>
      <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-[var(--pm-color-muted)]">
        <span>{task.duration}d</span>
        {task.resource ? <span className="truncate">{task.resource}</span> : null}
      </div>
    </button>
  );
}
