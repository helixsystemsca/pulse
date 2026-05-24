/**
 * Dashboard catalog — presentation metadata for dashboard flyout surfaces.
 * Routes and RBAC are defined in {@link DASHBOARD_ACCESS_REGISTRY}; this catalog drives grouping and homepages.
 */
import type { DashboardNavGroup, DashboardScope } from "@/config/platform/dashboard-scope";
import type { MasterFeatureIcon } from "@/config/platform/master-feature-registry";
import {
  DASHBOARD_ACCESS_REGISTRY,
  dashboardRbacAnyOf,
  type DashboardAccessDef,
} from "@/lib/dashboards/dashboard-permissions";

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

function scopeForDashboard(def: DashboardAccessDef): DashboardScope {
  switch (def.id) {
    case "dashboard_worker":
      return "personal";
    case "dashboard_project":
      return "project";
    case "monitoring":
      return "shared";
    case "dashboard":
      return "organization";
    default:
      return "department";
  }
}

function featureForDashboard(def: DashboardAccessDef): string {
  if (def.contractFeature !== "dashboard") return def.contractFeature;
  return def.matrixFeatureKey ?? "dashboard";
}

function rbacForDashboard(def: DashboardAccessDef): readonly string[] {
  if (def.id === "monitoring") return [def.viewPermission];
  if (def.id === "logs_inspections_dashboard") {
    return [...dashboardRbacAnyOf(def.viewPermission), "compliance.view"];
  }
  if (def.contractFeature !== "dashboard") return [def.viewPermission];
  return dashboardRbacAnyOf(def.viewPermission);
}

/** Canonical dashboard inventory for homepage assignment and pickers. */
export const DASHBOARD_CATALOG: readonly DashboardCatalogEntry[] = DASHBOARD_ACCESS_REGISTRY.map((def) => ({
  id: def.id,
  label: def.label,
  route: def.route,
  icon: def.icon,
  scope: scopeForDashboard(def),
  navGroup: def.navGroup,
  feature: featureForDashboard(def),
  rbacAnyOf: rbacForDashboard(def),
  ownershipDepartment: def.ownershipDepartment,
  isKiosk: def.isKiosk,
  sortOrder: def.sortOrder,
}));

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
