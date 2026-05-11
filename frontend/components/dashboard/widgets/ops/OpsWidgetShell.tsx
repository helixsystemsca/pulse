"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Shared chrome for facility-style operations widgets (neutral header + soft inner well).
 */
export function OpsWidgetShell({
  title,
  headerRight,
  children,
  className,
}: {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--ops-dash-border,#cbd5e1)_90%,transparent)] bg-[var(--ops-dash-widget-bg,#ffffff)] shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.03] dark:border-white/[0.09] dark:bg-[var(--ops-dash-widget-bg,#0f172a)] dark:ring-white/[0.06]",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-1.5 border-b border-[color-mix(in_srgb,var(--ops-dash-border-muted,#94a3b8)_40%,transparent)] bg-[color-mix(in_srgb,var(--ops-dash-widget-bg,#ffffff)_88%,var(--ops-dash-inner-bg,#f1f5f9))] px-2 py-1 dark:bg-[color-mix(in_srgb,#0f172a_85%,#1e293b)]">
        <p className="ops-widget-shell-title min-w-0 flex-1 truncate">{title}</p>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto ds-scroll bg-[var(--ops-dash-inner-bg,#f1f5f9)] px-2 py-1 dark:bg-[#0a0f18]">
        {children}
      </div>
    </div>
  );
}
