"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type KPIStatAccent = "neutral" | "success" | "warning" | "danger";

const accentBar: Record<KPIStatAccent, string> = {
  neutral: "bg-slate-200/90 dark:bg-slate-600/80",
  success: "bg-emerald-400/90",
  warning: "bg-amber-400/90",
  danger: "bg-rose-400/90",
};

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
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-slate-200/90 bg-white px-4 pb-4 pt-3.5 shadow-sm",
        "dark:border-slate-700/80 dark:bg-slate-900/60",
        className,
      )}
    >
      <div className={cn("absolute left-0 top-0 h-0.5 w-full", accentBar[accent])} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
      </div>
      <p className="mt-2 font-headline text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
        {value}
      </p>
    </div>
  );
}
