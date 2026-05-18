/**
 * Per-dashboard view permissions — sidebar flyout and route gates.
 * Legacy `dashboard.view` grants all dashboard surfaces until roles are migrated.
 */
import { PERMISSION_MATRIX_DEPARTMENT_LABEL, type PermissionMatrixDepartment } from "@/config/platform/permission-matrix";
import type { DashboardNavGroup } from "@/config/platform/dashboard-scope";
import type { MasterFeatureIcon } from "@/config/platform/master-feature-registry";

export const LEGACY_DASHBOARD_VIEW_PERMISSION = "dashboard.view";

/** Matrix / role-toggle feature keys (contract bucket: `dashboard`). */
export const DASHBOARD_MATRIX_FEATURE_KEYS = [
  "dashboard_operations",
  "dashboard_leadership",
  "dashboard_project",
  "dashboard_inspections",
  "dashboard_team_insights",
  "dashboard_kiosk",
  "dashboard_dept_communications",
  "dashboard_dept_aquatics",
  "dashboard_dept_reception",
  "dashboard_dept_fitness",
  "dashboard_dept_racquets",
  "dashboard_dept_admin",
] as const;

export type DashboardMatrixFeatureKey = (typeof DASHBOARD_MATRIX_FEATURE_KEYS)[number];

export type DashboardAccessDef = {
  /** Master feature / catalog id */
  id: string;
  label: string;
  route: string;
  icon: MasterFeatureIcon;
  navGroup: DashboardNavGroup;
  /** RBAC key required (unless legacy dashboard.view). */
  viewPermission: string;
  /** Role-matrix feature toggle key (omit for module-owned surfaces like monitoring). */
  matrixFeatureKey?: DashboardMatrixFeatureKey;
  /** Contract module required on the tenant (widget surfaces use `dashboard`). */
  contractFeature: "dashboard" | "monitoring" | "team_insights" | "logs_inspections";
  ownershipDepartment?: string;
  isKiosk?: boolean;
  sortOrder: number;
};

const DEPT_DASHBOARD_SLUGS = [
  "communications",
  "aquatics",
  "reception",
  "fitness",
  "racquets",
  "admin",
] as const;

function deptPermission(slug: string): string {
  return `dashboard.dept.${slug}.view`;
}

function deptMatrixKey(slug: string): DashboardMatrixFeatureKey {
  return `dashboard_dept_${slug}` as DashboardMatrixFeatureKey;
}

function deptRoute(slug: string): string {
  return `/dashboard/department/${slug}`;
}

function deptLabel(slug: PermissionMatrixDepartment): string {
  return `${PERMISSION_MATRIX_DEPARTMENT_LABEL[slug]} dashboard`;
}

/** Department blank dashboards (widget canvas); maintenance uses bespoke dashboards below. */
const DEPARTMENT_BLANK_DASHBOARDS: DashboardAccessDef[] = DEPT_DASHBOARD_SLUGS.map((slug, i) => ({
  id: `dashboard_dept_${slug}`,
  label: deptLabel(slug),
  route: deptRoute(slug),
  icon: "layout",
  navGroup: "Department Dashboards",
  viewPermission: deptPermission(slug),
  matrixFeatureKey: deptMatrixKey(slug),
  contractFeature: "dashboard",
  ownershipDepartment: slug,
  sortOrder: 200 + i,
}));

/** All assignable dashboard surfaces for the Dashboards flyout. */
export const DASHBOARD_ACCESS_REGISTRY: readonly DashboardAccessDef[] = [
  {
    id: "dashboard_worker",
    label: "Operations dashboard",
    route: "/worker",
    icon: "layout",
    navGroup: "My Dashboards",
    viewPermission: "dashboard.operations.view",
    matrixFeatureKey: "dashboard_operations",
    contractFeature: "dashboard",
    sortOrder: 10,
  },
  {
    id: "dashboard",
    label: "Leadership dashboard",
    route: "/overview",
    icon: "layout",
    navGroup: "Shared Dashboards",
    viewPermission: "dashboard.leadership.view",
    matrixFeatureKey: "dashboard_leadership",
    contractFeature: "dashboard",
    sortOrder: 20,
  },
  {
    id: "dashboard_project",
    label: "Project dashboard",
    route: "/overview/project",
    icon: "folder-kanban",
    navGroup: "Project Dashboards",
    viewPermission: "dashboard.project.view",
    matrixFeatureKey: "dashboard_project",
    contractFeature: "dashboard",
    sortOrder: 30,
  },
  {
    id: "monitoring",
    label: "Monitoring",
    route: "/monitoring",
    icon: "activity",
    navGroup: "Shared Dashboards",
    viewPermission: "monitoring.view",
    contractFeature: "monitoring",
    sortOrder: 40,
  },
  {
    id: "team_insights",
    label: "Team Insights",
    route: "/dashboard/team-insights",
    icon: "sparkles",
    navGroup: "Department Dashboards",
    viewPermission: "dashboard.team_insights.view",
    matrixFeatureKey: "dashboard_team_insights",
    contractFeature: "team_insights",
    ownershipDepartment: "maintenance",
    sortOrder: 50,
  },
  {
    id: "logs_inspections_dashboard",
    label: "Inspections & Logs",
    route: "/dashboard/compliance",
    icon: "scroll-text",
    navGroup: "Department Dashboards",
    viewPermission: "dashboard.inspections.view",
    matrixFeatureKey: "dashboard_inspections",
    contractFeature: "logs_inspections",
    ownershipDepartment: "maintenance",
    sortOrder: 60,
  },
  ...DEPARTMENT_BLANK_DASHBOARDS,
  {
    id: "kiosk_overview",
    label: "Kiosk — Overview",
    route: "/kiosk/overview",
    icon: "layout",
    navGroup: "Kiosk Displays",
    viewPermission: "dashboard.kiosk.view",
    matrixFeatureKey: "dashboard_kiosk",
    contractFeature: "dashboard",
    isKiosk: true,
    sortOrder: 80,
  },
  {
    id: "kiosk_leadership",
    label: "Kiosk — Leadership",
    route: "/kiosk/leadership",
    icon: "layout",
    navGroup: "Kiosk Displays",
    viewPermission: "dashboard.kiosk.view",
    matrixFeatureKey: "dashboard_kiosk",
    contractFeature: "dashboard",
    isKiosk: true,
    sortOrder: 90,
  },
  {
    id: "kiosk_worker",
    label: "Kiosk — Worker",
    route: "/kiosk/worker",
    icon: "layout",
    navGroup: "Kiosk Displays",
    viewPermission: "dashboard.kiosk.view",
    matrixFeatureKey: "dashboard_kiosk",
    contractFeature: "dashboard",
    isKiosk: true,
    sortOrder: 100,
  },
];

const permissionByDashboardId = new Map(DASHBOARD_ACCESS_REGISTRY.map((d) => [d.id, d.viewPermission]));

const GRANTED_BY_LEGACY = new Set(
  DASHBOARD_ACCESS_REGISTRY.filter((d) => d.contractFeature === "dashboard").map((d) => d.viewPermission),
);

/** RBAC keys that legacy `dashboard.view` satisfies. */
export const DASHBOARD_VIEW_PERMISSIONS = [...GRANTED_BY_LEGACY] as const;

export function dashboardViewPermissionForId(dashboardId: string): string | undefined {
  return permissionByDashboardId.get(dashboardId);
}

export function canViewDashboardById(
  session: import("@/lib/pulse-session").PulseAuthSession | null,
  dashboardId: string,
  hasRbac: (s: import("@/lib/pulse-session").PulseAuthSession | null, key: string) => boolean,
): boolean {
  const key = dashboardViewPermissionForId(dashboardId);
  if (!key) return false;
  if (hasRbac(session, key)) return true;
  if (GRANTED_BY_LEGACY.has(key) && hasRbac(session, LEGACY_DASHBOARD_VIEW_PERMISSION)) return true;
  return false;
}

export function rbacKeyGrantedByLegacyDashboardView(permissionKey: string): boolean {
  return GRANTED_BY_LEGACY.has(permissionKey);
}

/** RBAC keys accepted for a dashboard surface (granular + legacy umbrella). */
export function dashboardRbacAnyOf(viewPermission: string): readonly string[] {
  return [viewPermission, LEGACY_DASHBOARD_VIEW_PERMISSION];
}

export function dashboardAccessById(id: string): DashboardAccessDef | undefined {
  return DASHBOARD_ACCESS_REGISTRY.find((d) => d.id === id);
}

export function isDashboardMatrixFeatureKey(key: string): key is DashboardMatrixFeatureKey {
  return (DASHBOARD_MATRIX_FEATURE_KEYS as readonly string[]).includes(key);
}

/** Matrix / enabled_features key for a dashboard row (falls back to contract module). */
export function enabledFeatureKeyForDashboard(def: DashboardAccessDef): string {
  return def.matrixFeatureKey ?? def.contractFeature;
}

export function departmentDashboardStorageContext(departmentSlug: string): string {
  return `dept_${departmentSlug}`;
}
