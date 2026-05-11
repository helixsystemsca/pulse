"use client";

import { cn } from "@/lib/cn";

export type ComplianceBadgeVariant = "compliant" | "missing" | "expired" | "warning" | "neutral";

const styles: Record<ComplianceBadgeVariant, string> = {
  compliant:
    "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-950/50 dark:text-emerald-100",
  missing:
    "border-amber-200/90 bg-amber-50 text-amber-950 dark:border-amber-500/25 dark:bg-amber-950/40 dark:text-amber-50",
  expired:
    "border-rose-200/90 bg-rose-50 text-rose-900 dark:border-rose-500/25 dark:bg-rose-950/45 dark:text-rose-100",
  warning:
    "border-amber-200/80 bg-amber-50/90 text-amber-950 dark:border-amber-500/20 dark:bg-amber-950/35 dark:text-amber-50",
  neutral: "border-slate-200/90 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200",
};

export function ComplianceBadge({
  children,
  variant,
  className,
}: {
  children: React.ReactNode;
  variant: ComplianceBadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
