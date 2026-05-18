/**
 * Dashboard catalog — presentation metadata for all dashboard surfaces.
 * Routes and RBAC remain on {@link MASTER_FEATURES}; this catalog drives grouping and homepages.
 */
import type { DashboardNavGroup, DashboardScope } from "@/config/platform/dashboard-scope";
import type { MasterFeatureIcon } from "@/config/platform/master-feature-registry";

export type DashboardCatalogEntry = {
  /** Matches `MasterFeatureDef.key`. */
  id: string;
  label: string;
  route: string;
  icon: MasterFeatureIcon;
  scope: DashboardScope;
  navGroup: DashboardNavGroup;
  feature: string;
  rbacAnyOf: readonly string[];
  ownershipDepartment?: string;
  /** Kiosk / fullscreen display variant of a dashboard route. */
  isKiosk?: boolean;
  sortOrder: number;
};

/** Canonical dashboard inventory (aligned with master-feature-registry dashboard rows). */
export const DASHBOARD_CATALOG: readonly DashboardCatalogEntry[] = [
  {
    id: "dashboard_worker",
    label: "My operations view",
    route: "/worker",
    icon: "layout",
    scope: "personal",
    navGroup: "My Dashboards",
    feature: "dashboard",
    rbacAnyOf: ["dashboard.view"],
    sortOrder: 10,
  },
  {
    id: "dashboard",
    label: "Leadership overview",
    route: "/overview",
    icon: "layout",
    scope: "organization",
    navGroup: "Shared Dashboards",
    feature: "dashboard",
    rbacAnyOf: ["dashboard.view"],
    sortOrder: 20,
  },
  {
    id: "dashboard_project",
    label: "Project dashboard",
    route: "/overview/project",
    icon: "folder-kanban",
    scope: "project",
    navGroup: "Project Dashboards",
    feature: "projects",
    rbacAnyOf: ["projects.view"],
    sortOrder: 30,
  },
  {
    id: "monitoring",
    label: "Monitoring",
    route: "/monitoring",
    icon: "activity",
    scope: "shared",
    navGroup: "Shared Dashboards",
    feature: "monitoring",
    rbacAnyOf: ["monitoring.view"],
    sortOrder: 40,
  },
  {
    id: "team_insights",
    label: "Team Insights",
    route: "/dashboard/team-insights",
    icon: "sparkles",
    scope: "department",
    navGroup: "Department Dashboards",
    feature: "team_insights",
    rbacAnyOf: ["team_insights.view"],
    ownershipDepartment: "maintenance",
    sortOrder: 50,
  },
  {
    id: "logs_inspections",
    label: "Inspections & Logs",
    route: "/dashboard/compliance",
    icon: "scroll-text",
    scope: "department",
    navGroup: "Department Dashboards",
    feature: "logs_inspections",
    rbacAnyOf: ["compliance.view"],
    ownershipDepartment: "maintenance",
    sortOrder: 60,
  },
  {
    id: "work_requests",
    label: "Work Requests",
    route: "/dashboard/maintenance",
    icon: "clipboard",
    scope: "department",
    navGroup: "Department Dashboards",
    feature: "work_requests",
    rbacAnyOf: ["work_requests.view", "work_requests.edit"],
    ownershipDepartment: "maintenance",
    sortOrder: 70,
  },
  {
    id: "kiosk_overview",
    label: "Operations kiosk",
    route: "/kiosk/overview",
    icon: "layout",
    scope: "organization",
    navGroup: "Kiosk Displays",
    feature: "dashboard",
    rbacAnyOf: ["dashboard.view"],
    isKiosk: true,
    sortOrder: 80,
  },
  {
    id: "kiosk_leadership",
    label: "Leadership kiosk",
    route: "/kiosk/leadership",
    icon: "layout",
    scope: "organization",
    navGroup: "Kiosk Displays",
    feature: "dashboard",
    rbacAnyOf: ["dashboard.view"],
    isKiosk: true,
    sortOrder: 90,
  },
  {
    id: "kiosk_worker",
    label: "Worker break-room kiosk",
    route: "/kiosk/worker",
    icon: "layout",
    scope: "personal",
    navGroup: "Kiosk Displays",
    feature: "dashboard",
    rbacAnyOf: ["dashboard.view"],
    isKiosk: true,
    sortOrder: 100,
  },
] as const;

const byId = new Map(DASHBOARD_CATALOG.map((d) => [d.id, d]));
const byRoute = new Map(DASHBOARD_CATALOG.map((d) => [d.route, d]));

export function getDashboardCatalogEntry(id: string): DashboardCatalogEntry | undefined {
  return byId.get(id);
}

export function getDashboardCatalogEntryByRoute(route: string): DashboardCatalogEntry | undefined {
  const path = route.split("?")[0] ?? route;
  return byRoute.get(path);
}

export function dashboardsForScope(scope: DashboardScope): DashboardCatalogEntry[] {
  return DASHBOARD_CATALOG.filter((d) => d.scope === scope);
}

export function dashboardsForNavGroup(group: DashboardNavGroup): DashboardCatalogEntry[] {
  return DASHBOARD_CATALOG.filter((d) => d.navGroup === group);
}
