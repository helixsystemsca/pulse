/**
 * Dashboard presentation scope — metadata only.
 *
 * NEVER used for RBAC, contracts, or route guards.
 */

export const DASHBOARD_SCOPES = ["personal", "department", "project", "organization", "shared"] as const;

export type DashboardScope = (typeof DASHBOARD_SCOPES)[number];

export const DASHBOARD_SCOPE_LABEL: Record<DashboardScope, string> = {
  personal: "Personal",
  department: "Department",
  project: "Project",
  organization: "Organization",
  shared: "Shared",
};

/** Flyout section labels for the Dashboards domain (presentation order). */
export const DASHBOARD_NAV_GROUPS = [
  "My Dashboards",
  "Department Dashboards",
  "Project Dashboards",
  "Shared Dashboards",
] as const;

export type DashboardNavGroup = (typeof DASHBOARD_NAV_GROUPS)[number];

export function isDashboardScope(value: string): value is DashboardScope {
  return (DASHBOARD_SCOPES as readonly string[]).includes(value);
}

export function isDashboardNavGroup(value: string): value is DashboardNavGroup {
  return (DASHBOARD_NAV_GROUPS as readonly string[]).includes(value);
}

export function dashboardNavGroupSortIndex(group: string): number {
  const idx = DASHBOARD_NAV_GROUPS.indexOf(group as DashboardNavGroup);
  return idx >= 0 ? idx : DASHBOARD_NAV_GROUPS.length;
}
