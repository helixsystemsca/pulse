/**
 * Portfolio planning workspace (idea backlog, capacity views) — `projects.view`.
 * Consolidated under Project Management → Planning tab when PM access is available.
 */
import type { PulseAuthSession } from "@/lib/pulse-session";
import { canAccessClassicNavHref } from "@/lib/rbac/session-access";

export function canAccessPlanningWorkspace(session: PulseAuthSession | null): boolean {
  return canAccessClassicNavHref(session, "/planning");
}

const PLANNING_VIEW_TABS = new Set(["calendar", "timeline", "forecast", "capacity", "list"]);

export function parsePlanningWorkspaceView(raw: string | null): "calendar" | "timeline" | "forecast" | "capacity" | "list" {
  if (raw && PLANNING_VIEW_TABS.has(raw)) {
    return raw as "calendar" | "timeline" | "forecast" | "capacity" | "list";
  }
  return "list";
}

/** Map legacy `/planning?tab=` to Project Management planning tab + inner `view`. */
export function projectManagementPlanningHref(view: string | null = "list"): string {
  const v = parsePlanningWorkspaceView(view);
  return `/project-management?tab=planning&view=${v}`;
}
