"use client";

import {
  AlertTriangle,
  BarChart2,
  CalendarClock,
  ChevronLeft,
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
import type { ScheduleAlerts } from "@/lib/schedule/types";

export type ScheduleWorkspaceView = "calendar" | "my-shifts" | "personnel" | "reports";

type Props = {
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
  alerts: ScheduleAlerts;
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
  alerts,
  onOpenSettings,
  onOpenTimeOff,
  onOpenAvailabilitySupervisor,
  onOpenEmployeeAvailability,
  canConfigureOrg,
  disabled,
}: Props) {
  const alertCount =
    alerts.roP4BandGapCount +
    alerts.unassignedShiftCount +
    alerts.coverageCritical +
    alerts.coverageWarnings;

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
        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold transition-colors",
        workspaceView === key
          ? "bg-[color-mix(in_srgb,var(--ds-accent)_14%,transparent)] text-[var(--ds-accent)]"
          : "text-ds-foreground hover:bg-ds-interactive-hover",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </button>
  ));

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

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
        {!collapsed ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ds-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search workers, projects…"
              className="w-full rounded-lg border border-pulseShell-border bg-white/90 py-2 pl-8 pr-3 text-xs text-ds-foreground shadow-sm placeholder:text-ds-muted dark:bg-slate-900/80"
            />
          </div>
        ) : null}

        <div className="space-y-1">{nav}</div>

        {!collapsed ? (
          <>
            <div className="space-y-2">
              <SectionTitle>Facilities</SectionTitle>
              <div className="flex flex-wrap gap-1">
                {facilityFilterIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={onClearFacilityFilter}
                    className="rounded-md border border-dashed border-ds-border px-2 py-1 text-[11px] font-semibold text-ds-muted hover:text-ds-foreground"
                  >
                    Clear filter
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
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
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
            </div>

            <div className="space-y-2">
              <SectionTitle>Staffing signals</SectionTitle>
              <div className="rounded-xl border border-pulseShell-border/80 bg-white/70 p-3 text-xs dark:bg-slate-900/50">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1">
                    <p className="font-semibold text-ds-foreground">
                      {alertCount > 0 ? `${alertCount} open signal${alertCount === 1 ? "" : "s"}` : "No banner alerts"}
                    </p>
                    <p className="text-ds-muted">
                      RO/P4 band coverage and open shifts surface in the strip above the grid.
                    </p>
                  </div>
                </div>
              </div>
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
        ) : (
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
        )}
      </div>
    </aside>
  );
}
