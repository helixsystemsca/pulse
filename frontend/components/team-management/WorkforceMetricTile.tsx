import type { WorkforceMetric } from "@/lib/team-management/mock-data";
import { cn } from "@/lib/cn";

const TONE_CLASS: Record<NonNullable<WorkforceMetric["tone"]>, string> = {
  neutral: "text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)]",
  positive: "text-emerald-700 dark:text-emerald-300",
  caution: "text-amber-700 dark:text-amber-300",
  accent: "text-[var(--ds-accent)]",
};

export function WorkforceMetricTile({ metric, className }: { metric: WorkforceMetric; className?: string }) {
  const tone = metric.tone ?? "neutral";
  return (
    <div
      className={cn(
        "ops-dash-inner-card flex min-h-[5.5rem] flex-col justify-between p-4",
        className,
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
        {metric.label}
      </p>
      <p className={cn("text-2xl font-bold tabular-nums tracking-tight", TONE_CLASS[tone])}>{metric.value}</p>
      <p className="text-[11px] leading-snug text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">{metric.hint}</p>
    </div>
  );
}
