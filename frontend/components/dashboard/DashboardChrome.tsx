"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import {
  DASH,
  dashboardAccentShell,
  dashboardColumnShell,
  type DashboardCardTier,
  type DashboardSurfaceTheme,
} from "@/styles/dashboardTheme";
import { cn } from "@/lib/cn";
import { dashboardWidgetChromeStyle, type DashboardWidgetStyleOverride } from "@/lib/dashboardPageWidgetCatalog";

function KioskRotationCountdownRing({ durationMs, cycleKey }: { durationMs: number; cycleKey: number }) {
  const r = 15;
  const circumference = 2 * Math.PI * r;
  return (
    <motion.svg
      key={cycleKey}
      width={40}
      height={40}
      viewBox="0 0 40 40"
      className="shrink-0"
      aria-hidden
    >
      <circle cx="20" cy="20" r={r} fill="none" className="stroke-ds-border" strokeWidth="2.5" />
      <motion.circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        className="stroke-[color-mix(in_srgb,var(--ds-accent)_90%,transparent)]"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: circumference }}
        transition={{ duration: durationMs / 1000, ease: "linear" }}
        style={{ transform: "rotate(-90deg)", transformOrigin: "20px 20px" }}
      />
    </motion.svg>
  );
}

/**
 * Primary dashboard header / hero surfaces — layered gradients, premium shadow (see `.dash-card--*`).
 */
export function DashboardAccentCard({
  children,
  className,
  mutedAccent,
  innerClassName,
  styleOverride,
  tier = "standard",
}: {
  children: ReactNode;
  className?: string;
  /** Softer top rule instead of brand gradient. */
  mutedAccent?: boolean;
  innerClassName?: string;
  styleOverride?: DashboardWidgetStyleOverride;
  /** Visual hierarchy: hero (colorful), standard (default), board (large static canvas). */
  tier?: DashboardCardTier;
}) {
  const theme = (styleOverride?.theme ?? "tint") as DashboardSurfaceTheme;
  const styleVars: CSSProperties = {
    ...(styleOverride?.backgroundColor ? ({ ["--widget-tint" as string]: styleOverride.backgroundColor } as CSSProperties) : null),
    ...(styleOverride?.textColor ? ({ ["--widget-fg" as string]: styleOverride.textColor } as CSSProperties) : null),
    ...(styleOverride?.fontFamily ? ({ fontFamily: styleOverride.fontFamily } as CSSProperties) : null),
  };
  const chrome = dashboardWidgetChromeStyle(styleOverride);
  const shell = dashboardAccentShell(theme, tier);
  return (
    <div style={{ ...styleVars, ...chrome }} className={cn(shell, "text-[var(--widget-fg,var(--ds-text-primary))]", className)}>
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
  styleOverride,
}: {
  title: string;
  accent?: "muted" | "teal" | "danger" | "success" | "dusk";
  children: ReactNode;
  className?: string;
  styleOverride?: DashboardWidgetStyleOverride;
}) {
  const theme = (styleOverride?.theme ?? "tint") as DashboardSurfaceTheme;
  const styleVars: CSSProperties = {
    ...(styleOverride?.backgroundColor ? ({ ["--widget-tint" as string]: styleOverride.backgroundColor } as CSSProperties) : null),
    ...(styleOverride?.textColor ? ({ ["--widget-fg" as string]: styleOverride.textColor } as CSSProperties) : null),
    ...(styleOverride?.fontFamily ? ({ fontFamily: styleOverride.fontFamily } as CSSProperties) : null),
  };
  const chrome = dashboardWidgetChromeStyle(styleOverride);
  const shell = dashboardColumnShell(theme);
  const strip =
    accent === "teal"
      ? "bg-[color-mix(in_srgb,var(--ds-accent)_88%,transparent)]"
      : accent === "danger"
        ? "bg-[color-mix(in_srgb,var(--ds-danger)_75%,transparent)]"
        : accent === "success"
          ? "bg-[color-mix(in_srgb,var(--ds-success)_70%,#166534_30%)]"
          : accent === "dusk"
            ? "bg-[color-mix(in_srgb,var(--ds-accent-dusk)_70%,transparent)]"
            : "bg-[color-mix(in_srgb,var(--ds-text-primary)_14%,transparent)]";
  return (
    <div style={{ ...styleVars, ...chrome }} className={cn(shell, "flex h-full min-h-0 flex-col text-[var(--widget-fg,var(--ds-text-primary))]", className)}>
      <div className={cn("h-[3px] w-full shrink-0", strip)} aria-hidden />
      <div className="flex min-h-0 flex-1 flex-col p-2.5 sm:p-3">
        <p className={cn(DASH.sectionLabel, "truncate")} title={title}>
          {title}
        </p>
        <div className="ds-scroll mt-2 min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function KioskRotateFooter({
  activeIndex,
  total,
  intervalLabel = "Rotating every 15s",
  intervalMs = 15_000,
  rotationKey = 0,
  showCountdownRing = false,
  /** Match operations dashboard widget shell — tighter and neutral. */
  compact = false,
}: {
  activeIndex: number;
  total: number;
  intervalLabel?: string;
  intervalMs?: number;
  rotationKey?: number;
  showCountdownRing?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "col-span-12 flex w-full flex-wrap items-center justify-between text-ds-muted",
        compact ? "gap-2" : "gap-4",
        compact
          ? "rounded-2xl border border-[color-mix(in_srgb,var(--ops-dash-border,#cbd5e1)_88%,transparent)] bg-[var(--ops-dash-widget-bg,#ffffff)] px-3 py-2 text-[11px] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_14px_-6px_rgba(15,23,42,0.1)] dark:border-white/[0.09] dark:bg-[var(--ops-dash-widget-bg,#0f172a)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.28),0_4px_14px_-6px_rgba(0,0,0,0.35)]"
          : "rounded-[var(--dash-card-radius)] border border-[color-mix(in_srgb,var(--ds-text-primary)_9%,transparent)] bg-[linear-gradient(180deg,rgb(255_255_255_/0.82),rgb(248_250_252_/0.92))] px-4 py-3 text-xs shadow-[var(--dash-shadow-card-soft)] backdrop-blur-md dark:border-[rgb(255_255_255_/0.1)] dark:bg-[color-mix(in_srgb,var(--ds-surface-primary)_92%,transparent)]",
      )}
    >
      <div className={cn("flex min-w-0 flex-1 flex-wrap items-center justify-center", compact ? "gap-3" : "gap-4")}>
        <span>{intervalLabel}</span>
        <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")} role="tablist" aria-label="Dashboard view rotation">
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
      {showCountdownRing ? <KioskRotationCountdownRing durationMs={intervalMs} cycleKey={rotationKey} /> : null}
    </div>
  );
}
