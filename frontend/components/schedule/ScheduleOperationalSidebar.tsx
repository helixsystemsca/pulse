"use client";

import {
  BarChart2,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  PanelLeftClose,
  PanelLeft,
  Search,
  Settings,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Zone } from "@/lib/schedule/types";

export type ScheduleWorkspaceView = "calendar" | "my-shifts" | "personnel" | "reports";

type Props = {
  /** `inline` — single compact row for the unified control card. `header` is legacy; prefer `inline`. */
  variant?: "sidebar" | "header" | "inline";
  collapsed: boolean;
  onToggleCollapsed: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  workspaceView: ScheduleWorkspaceView;
  onWorkspaceViewChange: (v: ScheduleWorkspaceView) => void;
  zones: Zone[];
  facilityFilterIds: string[];
  onFacilityFilterToggle: (zoneId: string) => void;
  onClearFacilityFilter: () => void;
  onOpenSettings: () => void;
  onOpenTimeOff: () => void;
  onOpenAvailabilitySupervisor: () => void;
  onOpenEmployeeAvailability: () => void;
  canConfigureOrg: boolean;
  disabled?: boolean;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">{children}</p>
  );
}

export function ScheduleOperationalSidebar({
  variant = "sidebar",
  collapsed,
  onToggleCollapsed,
  searchQuery,
  onSearchChange,
  workspaceView,
  onWorkspaceViewChange,
  zones,
  facilityFilterIds,
  onFacilityFilterToggle,
  onClearFacilityFilter,
  onOpenSettings,
  onOpenTimeOff,
  onOpenAvailabilitySupervisor,
  onOpenEmployeeAvailability,
  canConfigureOrg,
  disabled,
}: Props) {
  const isHeader = variant === "header";
  const isInline = variant === "inline";
  const showExpanded = !collapsed || isHeader || isInline;

  const nav = (
    [
      ["calendar", "Schedule", PanelLeft],
      ["my-shifts", "My shifts", User],
      ["personnel", "Personnel", Users],
      ["reports", "Reports", BarChart2],
    ] as const
  ).map(([key, label, Icon]) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      onClick={() => onWorkspaceViewChange(key)}
      title={label}
      className={cn(
        "flex items-center gap-2 rounded-lg text-left font-semibold transition-colors",
        isInline ? "shrink-0 px-2 py-1.5 text-xs" : "gap-2 px-2 py-2 text-sm",
        !isHeader && !isInline && "w-full",
        (isHeader || isInline) && "shrink-0",
        workspaceView === key
          ? "bg-[color-mix(in_srgb,var(--ds-accent)_14%,transparent)] text-[var(--ds-accent)]"
          : "text-ds-foreground hover:bg-ds-interactive-hover",
      )}
    >
      <Icon className={cn("shrink-0 opacity-90", isInline ? "h-3.5 w-3.5" : "h-4 w-4")} />
      {showExpanded ? <span className="truncate">{label}</span> : null}
    </button>
  ));

  const searchField = showExpanded ? (
    <div className="relative min-w-0">
      <Search
        className={cn(
          "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ds-muted",
          isInline ? "h-3 w-3" : "h-3.5 w-3.5",
        )}
      />
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search workers, projects…"
        className={cn(
          "w-full rounded-lg border border-pulseShell-border bg-white/90 pl-8 pr-3 text-ds-foreground shadow-sm placeholder:text-ds-muted dark:bg-slate-900/80",
          isInline ? "py-1.5 text-[11px]" : "py-2 text-xs",
        )}
      />
    </div>
  ) : null;

  const facilityChips = showExpanded ? (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {facilityFilterIds.length > 0 ? (
        <button
          type="button"
          onClick={onClearFacilityFilter}
          className="rounded-md border border-dashed border-ds-border px-2 py-0.5 text-[10px] font-semibold text-ds-muted hover:text-ds-foreground"
        >
          Clear
        </button>
      ) : null}
      {zones.map((z) => {
        const on = facilityFilterIds.includes(z.id);
        return (
          <button
            key={z.id}
            type="button"
            onClick={() => onFacilityFilterToggle(z.id)}
            className={cn(
              "rounded-full border font-semibold transition-colors",
              isInline ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
              on
                ? "border-[color-mix(in_srgb,var(--ds-accent)_40%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-accent)_12%,transparent)] text-[var(--ds-accent)]"
                : "border-pulseShell-border bg-white/80 text-ds-muted hover:text-ds-foreground dark:bg-slate-900/60",
            )}
          >
            {z.label}
          </button>
        );
      })}
    </div>
  ) : null;

  if (isInline) {
    return (
      <div
        className={cn(
          "flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <div className="flex flex-wrap gap-1">{nav}</div>
        <div className="w-full min-w-[10rem] max-w-[16rem] sm:w-44 sm:flex-1">{searchField}</div>
        {facilityChips}
        <div className="flex shrink-0 flex-wrap items-center gap-1 sm:ml-auto">
          <button
            type="button"
            title="Availability desk"
            onClick={onOpenAvailabilitySupervisor}
            className="rounded-lg border border-pulseShell-border bg-white/90 p-2 text-ds-foreground shadow-sm hover:bg-ds-interactive-hover dark:bg-slate-900/70"
          >
            <CalendarClock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </button>
          <button
            type="button"
            title="Edit employee availability"
            onClick={onOpenEmployeeAvailability}
            className="rounded-lg border border-pulseShell-border bg-white/90 p-2 text-ds-foreground shadow-sm hover:bg-ds-interactive-hover dark:bg-slate-900/70"
          >
            <ClipboardList className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </button>
          <button
            type="button"
            title="Time off requests"
            onClick={onOpenTimeOff}
            className="rounded-lg border border-pulseShell-border bg-white/90 p-2 text-ds-foreground shadow-sm hover:bg-ds-interactive-hover dark:bg-slate-900/70"
          >
            <ChevronRight className="h-4 w-4 text-ds-muted" />
          </button>
          {canConfigureOrg ? (
            <button
              type="button"
              title="Schedule settings"
              onClick={onOpenSettings}
              className="rounded-lg border border-pulseShell-border bg-white/90 p-2 text-ds-foreground shadow-sm hover:bg-ds-interactive-hover dark:bg-slate-900/70"
            >
              <Settings className="h-4 w-4 text-ds-muted" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const body = (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-4 overflow-y-auto",
        isHeader ? "max-h-[min(42vh,380px)] p-0" : "min-h-0 flex-1 p-2",
      )}
    >
      {isHeader ? (
        <>
          <div className="flex flex-wrap gap-1">{nav}</div>
          {searchField}
        </>
      ) : (
        <>
          {searchField}
          <div className="space-y-1">{nav}</div>
        </>
      )}

        {showExpanded ? (
          <>
            <div className="space-y-2">
              <SectionTitle>Facilities</SectionTitle>
              {facilityChips}
            </div>

            <div className="space-y-2">
              <SectionTitle>Availability & training</SectionTitle>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={onOpenAvailabilitySupervisor}
                  className="flex items-center gap-2 rounded-lg border border-pulseShell-border bg-white/80 px-2 py-2 text-left text-sm font-semibold text-ds-foreground hover:bg-ds-interactive-hover dark:bg-slate-900/60"
                >
                  <CalendarClock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  Availability desk
                </button>
                <button
                  type="button"
                  onClick={onOpenEmployeeAvailability}
                  className="flex items-center gap-2 rounded-lg border border-pulseShell-border bg-white/80 px-2 py-2 text-left text-sm font-semibold text-ds-foreground hover:bg-ds-interactive-hover dark:bg-slate-900/60"
                >
                  <ClipboardList className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  Edit employee availability
                </button>
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-pulseShell-border px-2 py-2 text-xs text-ds-muted">
                  <GraduationCap className="h-4 w-4 shrink-0" />
                  Training conflicts hook into operational badges — intelligence layer coming next.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <SectionTitle>Workspace</SectionTitle>
              <button
                type="button"
                onClick={onOpenTimeOff}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-ds-foreground hover:bg-ds-interactive-hover"
              >
                <ChevronRight className="h-4 w-4 text-ds-muted" />
                Time off requests
              </button>
              {canConfigureOrg ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-ds-foreground hover:bg-ds-interactive-hover"
                >
                  <Settings className="h-4 w-4 text-ds-muted" />
                  Schedule settings
                </button>
              ) : null}
            </div>
          </>
        ) : !isHeader ? (
          <div className="flex flex-col gap-1 border-t border-pulseShell-border pt-2 dark:border-slate-800">
            <button
              type="button"
              title="Availability desk"
              onClick={onOpenAvailabilitySupervisor}
              className="rounded-lg p-2 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
            >
              <CalendarClock className="mx-auto h-4 w-4" />
            </button>
            <button
              type="button"
              title="Settings"
              onClick={canConfigureOrg ? onOpenSettings : onOpenTimeOff}
              className="rounded-lg p-2 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
            >
              <Settings className="mx-auto h-4 w-4" />
            </button>
          </div>
        ) : null}
    </div>
  );

  if (isHeader) {
    return (
      <div
        className={cn(
          "min-w-0 shrink-0 xl:max-w-[min(100%,400px)]",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <SectionTitle>Operations</SectionTitle>
        <div className="mt-2 space-y-3">{body}</div>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-2xl border border-pulseShell-border/90 bg-gradient-to-b from-white to-slate-50/95 shadow-[0_10px_36px_-16px_rgba(15,23,42,0.2)] transition-[width] duration-200 dark:from-slate-950 dark:to-slate-900/90 dark:border-slate-700/80",
        collapsed ? "w-[52px]" : "w-full min-w-[260px] max-w-[320px]",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-1 border-b border-pulseShell-border/80 px-2 py-2 dark:border-slate-800">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-lg p-2 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
          aria-label={collapsed ? "Expand schedule sidebar" : "Collapse schedule sidebar"}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        {!collapsed ? (
          <span className="truncate pr-1 text-xs font-bold uppercase tracking-wide text-ds-muted">Operations</span>
        ) : null}
      </div>
      {body}
    </aside>
  );
}
