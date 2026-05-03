"use client";

import type { ReactNode } from "react";
import { DASH } from "@/styles/dashboardTheme";
import { cn } from "@/lib/cn";

/** White card with thin teal → dusk accent (Pool Shutdown header pattern). */
export function DashboardAccentCard({
  children,
  className,
  mutedAccent,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  /** Softer top rule instead of brand gradient. */
  mutedAccent?: boolean;
  innerClassName?: string;
}) {
  return (
    <div className={cn(DASH.cardBase, className)}>
      <div className={mutedAccent ? DASH.accentBarMuted : DASH.accentBar} aria-hidden />
      <div className={cn(DASH.cardInner, innerClassName)}>{children}</div>
    </div>
  );
}

/** Column panel with optional 3px status strip (Kanban column headers in mock). */
export function DashboardColumnPanel({
  title,
  accent = "muted",
  children,
  className,
}: {
  title: string;
  accent?: "muted" | "teal" | "danger" | "success" | "dusk";
  children: ReactNode;
  className?: string;
}) {
  const strip =
    accent === "teal"
      ? "bg-[color-mix(in_srgb,var(--ds-accent)_88%,transparent)]"
      : accent === "danger"
        ? "bg-[color-mix(in_srgb,var(--ds-danger)_75%,transparent)]"
        : accent === "success"
          ? "bg-[color-mix(in_srgb,var(--ds-success)_70%,#166534_30%)]"
          : accent === "dusk"
            ? "bg-[color-mix(in_srgb,var(--ds-accent-dusk)_70%,transparent)]"
            : "bg-ds-border";
  return (
    <div className={cn(DASH.cardBase, "flex h-full min-h-0 flex-col", className)}>
      <div className={cn("h-[3px] w-full shrink-0", strip)} aria-hidden />
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <p className={DASH.sectionLabel}>{title}</p>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function KioskRotateFooter({
  activeIndex,
  total,
  intervalLabel = "Rotating every 15s",
}: {
  activeIndex: number;
  total: number;
  intervalLabel?: string;
}) {
  return (
    <div className="col-span-12 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-ds-border bg-ds-primary px-4 py-3 text-xs text-ds-muted">
      <span>{intervalLabel}</span>
      <div className="flex items-center gap-2" role="tablist" aria-label="Dashboard view rotation">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-colors",
              i === activeIndex ? "bg-ds-accent" : "bg-ds-border",
            )}
            aria-current={i === activeIndex ? "step" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
