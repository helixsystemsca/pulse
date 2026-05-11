"use client";

import { cn } from "@/lib/cn";

export function ProgressCell({
  pct,
  label,
  className,
}: {
  pct: number;
  label: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn("min-w-[7rem] space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">{clamped}%</span>
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            clamped >= 100
              ? "bg-emerald-500"
              : clamped >= 70
                ? "bg-teal-500"
                : clamped >= 40
                  ? "bg-amber-500"
                  : "bg-rose-500",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
