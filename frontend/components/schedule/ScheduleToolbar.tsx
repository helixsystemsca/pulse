"use client";

import { Calendar as CalendarIcon, CalendarDays, CalendarRange, LayoutGrid, LayoutList } from "lucide-react";
import { cn } from "@/lib/cn";

export type ScheduleTimeScale = "month" | "week" | "day";
export type ScheduleLayoutMode = "calendar" | "ops-grid";
export type ScheduleContentFilter = "workers" | "projects" | "combined";

type Props = {
  /** Omit outer card chrome when nested inside the unified schedule header. */
  embedded?: boolean;
  /** Single dense row for the unified control card (no section labels). */
  compact?: boolean;
  timeScale: ScheduleTimeScale;
  onTimeScaleChange: (v: ScheduleTimeScale) => void;
  scheduleLayout: ScheduleLayoutMode;
  onScheduleLayoutChange: (v: ScheduleLayoutMode) => void;
  contentFilter: ScheduleContentFilter;
  onContentFilterChange: (v: ScheduleContentFilter) => void;
  showProjectOverlay: boolean;
  onToggleProjectOverlay: () => void;
  disabled?: boolean;
};

function Seg({
  active,
  children,
  onClick,
  disabled,
  title,
  compact: compactSeg,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        compactSeg ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
        active
          ? "bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--ds-accent)_28%,transparent)] dark:ring-sky-400/30"
          : "text-gray-500 hover:bg-ds-interactive-hover-strong hover:text-gray-900 dark:text-slate-400 dark:hover:bg-ds-interactive-hover dark:hover:text-slate-100",
      )}
    >
      {children}
    </button>
  );
}

export function ScheduleToolbar({
  embedded = false,
  compact = false,
  timeScale,
  onTimeScaleChange,
  scheduleLayout,
  onScheduleLayoutChange,
  contentFilter,
  onContentFilterChange,
  showProjectOverlay,
  onToggleProjectOverlay,
  disabled,
}: Props) {
  const opsGrid = scheduleLayout === "ops-grid";

  const navShell =
    "flex flex-wrap rounded-xl border border-pulseShell-border bg-gradient-to-b from-white to-slate-50/90 p-1 shadow-sm dark:from-slate-900 dark:to-slate-950/90";

  return (
    <div
      className={cn(
        compact ? "flex flex-col gap-3" : "flex flex-col gap-4",
        embedded
          ? "px-0 py-0"
          : compact
            ? "px-0 py-0"
            : "rounded-2xl border border-pulseShell-border/90 bg-pulseShell-surface/90 px-4 py-4 shadow-[0_8px_30px_-14px_rgba(15,23,42,0.18)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-950/60",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <div
        className={cn(
          compact
            ? "flex flex-col gap-3 xl:flex-row xl:flex-nowrap xl:items-center xl:justify-between"
            : "flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between",
        )}
      >
        <div className={cn(!compact && "space-y-2")}>
          {!compact ? (
            <p className="text-[11px] font-bold uppercase tracking-wider text-ds-muted">Time view</p>
          ) : null}
          <nav
            className={cn(navShell, compact && "inline-flex")}
            aria-label="Calendar time scale"
          >
            <Seg
              compact={compact}
              active={timeScale === "month" && !opsGrid}
              disabled={opsGrid}
              title={opsGrid ? "Switch to Calendar layout to use month view" : undefined}
              onClick={() => {
                onScheduleLayoutChange("calendar");
                onTimeScaleChange("month");
              }}
            >
              <LayoutGrid className={cn("opacity-90", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              Month
            </Seg>
            <Seg
              compact={compact}
              active={(timeScale === "week" && !opsGrid) || opsGrid}
              onClick={() => {
                onScheduleLayoutChange("calendar");
                onTimeScaleChange("week");
              }}
            >
              <CalendarRange className={cn("opacity-90", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              Week
            </Seg>
            <Seg
              compact={compact}
              active={timeScale === "day" && !opsGrid}
              disabled={opsGrid}
              title={opsGrid ? "Switch to Calendar layout to use day view" : undefined}
              onClick={() => {
                onScheduleLayoutChange("calendar");
                onTimeScaleChange("day");
              }}
            >
              <CalendarDays className={cn("opacity-90", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              Day
            </Seg>
          </nav>
        </div>

        <div className={cn(!compact && "space-y-2")}>
          {!compact ? (
            <p className="text-[11px] font-bold uppercase tracking-wider text-ds-muted">Layout</p>
          ) : null}
          <nav className={cn(navShell, compact && "inline-flex")} aria-label="Schedule layout mode">
            <Seg compact={compact} active={scheduleLayout === "calendar"} onClick={() => onScheduleLayoutChange("calendar")}>
              <CalendarIcon className={cn("opacity-90", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              Calendar
            </Seg>
            <Seg
              compact={compact}
              active={scheduleLayout === "ops-grid"}
              onClick={() => {
                onScheduleLayoutChange("ops-grid");
                onTimeScaleChange("week");
              }}
            >
              <LayoutList className={cn("opacity-90", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              Ops grid
            </Seg>
          </nav>
        </div>

        <div className={cn(!compact && "space-y-2", compact && "min-w-0 flex-1")}>
          {!compact ? (
            <p className="text-[11px] font-bold uppercase tracking-wider text-ds-muted">Display</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <nav
              id="schedule-toggle"
              className={cn(navShell, "flex flex-wrap")}
              aria-label="Schedule content filter"
            >
              {(
                [
                  ["workers", "Workers"],
                  ["projects", "Projects"],
                  ["combined", "Combined"],
                ] as const
              ).map(([key, label]) => (
                <Seg key={key} compact={compact} active={contentFilter === key} onClick={() => onContentFilterChange(key)}>
                  {label}
                </Seg>
              ))}
            </nav>
            <button
              type="button"
              onClick={onToggleProjectOverlay}
              className={cn(
                "rounded-lg border font-semibold transition-colors",
                compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs",
                showProjectOverlay
                  ? "border-[color-mix(in_srgb,var(--ds-accent)_35%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-accent)_10%,transparent)] text-[var(--ds-accent)]"
                  : "border-pulseShell-border bg-white/80 text-ds-muted hover:text-ds-foreground dark:bg-slate-900/50",
              )}
              title={showProjectOverlay ? "Hide project timeline overlay" : "Show project timeline overlay"}
            >
              Project overlay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
