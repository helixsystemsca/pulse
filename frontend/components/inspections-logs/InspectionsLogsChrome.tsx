"use client";

import type { LucideIcon } from "lucide-react";
import { Archive, ChevronRight, ClipboardList, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/pulse/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

/** Matches `ScheduleUnifiedControlCard` — premium operational shell (design-system shadows via CSS vars in dark). */
export const INSPECTIONS_OP_HERO_SHELL =
  "rounded-[20px] border border-pulseShell-border/90 bg-white px-5 py-4 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.18)] dark:border-slate-700/80 dark:bg-slate-950/80 dark:shadow-black/35 sm:px-6 sm:py-5";

const SEGMENT_TRACK =
  "flex flex-wrap rounded-md border border-pulseShell-border bg-pulseShell-surface p-1 shadow-[var(--pulse-shell-shadow)]";
const SEGMENT_ACTIVE =
  "bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--ds-accent)_28%,transparent)] dark:ring-sky-400/30";
const SEGMENT_IDLE =
  "text-gray-500 hover:bg-ds-interactive-hover-strong hover:text-gray-900 dark:text-slate-400 dark:hover:bg-ds-interactive-hover dark:hover:text-slate-100";

export type InspectionsLogsTab = "inspections" | "logs" | "archive";

export function InspectionsLogsHero({
  title,
  subtitle,
  metadata,
  icon: Icon,
  onNewInspectionTemplate,
  onNewLogTemplate,
  onGoArchive,
  tab,
  onTabChange,
}: {
  title: string;
  subtitle: string;
  metadata: ReactNode;
  icon: LucideIcon;
  onNewInspectionTemplate: () => void;
  onNewLogTemplate: () => void;
  onGoArchive: () => void;
  tab: InspectionsLogsTab;
  onTabChange: (t: InspectionsLogsTab) => void;
}) {
  return (
    <section className={INSPECTIONS_OP_HERO_SHELL} aria-labelledby="inspections-logs-hero-title">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="flex min-w-0 gap-3 sm:gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-pulseShell-border bg-pulseShell-surface text-ds-accent shadow-[var(--pulse-shell-shadow)] dark:border-slate-700/80 dark:bg-slate-900/60"
            aria-hidden
          >
            <Icon className="h-6 w-6" strokeWidth={2} />
          </span>
          <div className="min-w-0 space-y-2">
            <div>
              <h1
                id="inspections-logs-hero-title"
                className="font-body text-2xl font-bold tracking-tight text-ds-foreground md:text-3xl"
              >
                {title}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ds-muted">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-ds-muted">
              {metadata}
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 sm:max-w-md lg:w-auto lg:min-w-[min(100%,18rem)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end lg:flex-col xl:flex-row xl:flex-wrap xl:justify-end">
            <button
              type="button"
              className={cn(
                buttonVariants({ surface: "light", intent: "accent" }),
                "inline-flex min-h-[44px] items-center justify-center gap-2 px-5 py-3 text-base font-semibold shadow-[var(--ds-shadow-card)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 active:translate-y-0",
              )}
              onClick={onNewInspectionTemplate}
            >
              <Plus className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
              New inspection template
            </button>
            <button
              type="button"
              className={cn(
                buttonVariants({ surface: "light", intent: "secondary" }),
                "inline-flex min-h-[44px] items-center justify-center gap-2 px-4 py-3 text-sm font-semibold shadow-sm transition-colors duration-200",
              )}
              onClick={onNewLogTemplate}
            >
              <ClipboardList className="h-4 w-4 shrink-0 text-ds-accent" aria-hidden />
              New log template
            </button>
            <button
              type="button"
              className={cn(
                buttonVariants({ surface: "light", intent: "secondary" }),
                "inline-flex min-h-[44px] items-center justify-center gap-1.5 border-dashed px-4 py-3 text-sm font-semibold",
              )}
              onClick={onGoArchive}
            >
              <Archive className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Archive
              <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
            </button>
          </div>

          <nav className={SEGMENT_TRACK} aria-label="Workspace">
            <button
              type="button"
              className={cn(
                "min-h-[40px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                tab === "inspections" ? SEGMENT_ACTIVE : SEGMENT_IDLE,
              )}
              onClick={() => onTabChange("inspections")}
            >
              Inspections
            </button>
            <button
              type="button"
              className={cn(
                "min-h-[40px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                tab === "logs" ? SEGMENT_ACTIVE : SEGMENT_IDLE,
              )}
              onClick={() => onTabChange("logs")}
            >
              Logs
            </button>
            <button
              type="button"
              className={cn(
                "min-h-[40px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                tab === "archive" ? SEGMENT_ACTIVE : SEGMENT_IDLE,
              )}
              onClick={() => onTabChange("archive")}
            >
              Archive
            </button>
          </nav>
        </div>
      </div>
    </section>
  );
}

export function InspectionsLogsMetricsInspections({
  templateCount,
  completedTotal,
  completedToday,
  needsAttentionCount,
}: {
  templateCount: number;
  completedTotal: number;
  completedToday: number;
  needsAttentionCount: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Checklist templates" value={templateCount} borderAccent="neutral" hint="Defined in this workspace" />
      <MetricCard
        label="Completed runs"
        value={completedTotal}
        borderAccent="info"
        hint="All-time inspection completions"
      />
      <MetricCard label="Completed today" value={completedToday} borderAccent="success" hint="Local device time" />
      <MetricCard
        label="Needs attention"
        value={needsAttentionCount}
        borderAccent={needsAttentionCount > 0 ? "warning" : "neutral"}
        hint="Templates with no recorded run yet"
      />
    </div>
  );
}

export function InspectionsLogsMetricsLogs({
  templateCount,
  entriesTotal,
  entriesToday,
}: {
  templateCount: number;
  entriesTotal: number;
  entriesToday: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard label="Log templates" value={templateCount} borderAccent="neutral" hint="Operational forms" />
      <MetricCard label="Submitted entries" value={entriesTotal} borderAccent="info" hint="Stored for this workspace" />
      <MetricCard label="Entries today" value={entriesToday} borderAccent="success" hint="Local device time" />
    </div>
  );
}

export function InspectionQuickInspectionCard({
  icon: Icon,
  title,
  description,
  meta,
  actionLabel,
  expanded,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  meta: ReactNode;
  actionLabel: string;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <Card
      variant="elevated"
      padding="none"
      className="overflow-hidden transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ds-border bg-ds-primary text-ds-accent shadow-sm">
            <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-ds-foreground">{title}</h2>
            <p className="text-sm leading-snug text-ds-muted">{description}</p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium text-ds-muted">{meta}</div>
          </div>
        </div>
        <div className="flex shrink-0 sm:pt-0.5">
          <button
            type="button"
            className={cn(
              buttonVariants({ surface: "light", intent: expanded ? "secondary" : "accent" }),
              "min-h-[44px] w-full px-4 py-2.5 text-sm font-semibold shadow-sm transition-transform duration-200 active:scale-[0.99] sm:w-auto",
            )}
            onClick={onToggle}
            aria-expanded={expanded}
          >
            {actionLabel}
          </button>
        </div>
      </div>
      {expanded && children ? (
        <div className="border-t border-ds-border/80 bg-ds-primary/40 p-4 dark:bg-ds-secondary/30 sm:px-5 sm:py-5">
          {children}
        </div>
      ) : null}
    </Card>
  );
}
