"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { KPI_ACCENT_BAR_CLASS, type KPIStatAccent } from "@/lib/theme/status-variants";
import { uiDashCardWidget, uiIconSm, uiKpiLabel, uiKpiValue } from "@/styles/ui-classes";

export type { KPIStatAccent };

export function KPIStatCard({
  label,
  value,
  icon: Icon,
  accent = "neutral",
  className,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: KPIStatAccent;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden px-4 pb-4 pt-3.5", uiDashCardWidget, className)}>
      <div className={cn("absolute left-0 top-0 h-0.5 w-full", KPI_ACCENT_BAR_CLASS[accent])} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className={uiKpiLabel}>{label}</p>
        <Icon className={cn(uiIconSm, "text-ds-muted")} aria-hidden />
      </div>
      <p className={cn("mt-2", uiKpiValue)}>{value}</p>
    </div>
  );
}
