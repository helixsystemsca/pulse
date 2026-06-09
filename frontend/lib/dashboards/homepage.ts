/**
 * Assigned dashboard homepage — role/department defaults with personal overrides.
 * Presentation + routing only; access checks use the universal permission matrix.
 */
import { DASHBOARD_CATALOG, getDashboardCatalogEntry, type DashboardCatalogEntry } from "@/lib/dashboards/catalog";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { isInventoryScannerOnlySession } from "@/lib/inventory-scanner/scanner-session";
import { sessionPrimaryRole } from "@/lib/pulse-roles";
import { canAccessClassicNavHref, tenantHasAnyCompanyModule } from "@/lib/rbac/session-access";

const STORAGE_KEY = "pulse.dashboard.homepage.override.v1";

/** Role → default dashboard catalog id (when route is accessible). */
const ROLE_DEFAULT_DASHBOARD_ID: Record<string, string> = {
  worker: "dashboard_worker",
  lead: "dashboard",
  supervisor: "dashboard",
  manager: "dashboard",
  company_admin: "dashboard",
  demo_viewer: "dashboard",
};

/** Department module homes outside the dashboard flyout catalog. */
const DEPARTMENT_MODULE_HOME_ROUTES: Record<string, string> = {
  maintenance: "/dashboard/maintenance",
};

/** Department slug → default department-scoped dashboard. */
const DEPARTMENT_DEFAULT_DASHBOARD_ID: Record<string, string> = {
  communications: "dashboard_dept_communications",
  aquatics: "dashboard_dept_aquatics",
  reception: "dashboard_dept_reception",
  fitness: "dashboard_dept_fitness",
  racquets: "dashboard_dept_racquets",
  admin: "dashboard_dept_admin",
};

/** Product module homes when the tenant has no dashboard routes. */
const CONTRACT_MODULE_HOME_ROUTES: readonly { contractKeys: readonly string[]; route: string }[] = [
  { contractKeys: ["operational_improvements"], route: "/dashboard/operational-improvements" },
  { contractKeys: ["inventory", "inventory_scanner"], route: "/dashboard/inventory" },
  { contractKeys: ["work_requests"], route: "/dashboard/maintenance" },
  { contractKeys: ["monitoring"], route: "/monitoring" },
  { contractKeys: ["equipment", "tool_tracking", "rtls_tracking"], route: "/dashboard/equipment" },
  { contractKeys: ["projects"], route: "/planning" },
  { contractKeys: ["schedule"], route: "/schedule" },
  { contractKeys: ["procedures", "standards"], route: "/standards" },
  { contractKeys: ["team_management"], route: "/team-management" },
];

/** Contract modules that justify the facility leadership / operations dashboard landing. */
const FACILITY_OPS_CONTRACT_KEYS = [
  "monitoring",
  "work_requests",
  "inventory",
  "inventory_scanner",
  "schedule",
  "team_management",
  "equipment",
  "tool_tracking",
  "rtls_tracking",
  "logs_inspections",
] as const;

const IMPROVEMENT_FOCUSED_MODULE_HOME = "/dashboard/operational-improvements";

/**
 * Tenants with continuous improvement but no facility ops modules (personal portfolio, CI-only).
 * These should not land on `/overview` or the Panorama-style ops dashboard.
 */
export function tenantIsImprovementFocused(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  if (!tenantHasAnyCompanyModule(session, ["operational_improvements"])) return false;
  return !tenantHasAnyCompanyModule(session, FACILITY_OPS_CONTRACT_KEYS);
}

export function resolveImprovementFocusedModuleHome(session: PulseAuthSession | null): string | null {
  if (!tenantIsImprovementFocused(session)) return null;
  if (!canAccessClassicNavHref(session, IMPROVEMENT_FOCUSED_MODULE_HOME)) return null;
  return IMPROVEMENT_FOCUSED_MODULE_HOME;
}

export type DashboardHomepagePreference = {
  dashboardId: string;
  setAt: string;
};

function readAllOverrides(): Record<string, DashboardHomepagePreference> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, DashboardHomepagePreference>) : {};
  } catch {
    return {};
  }
}

export function readPersonalDashboardHomepageOverride(userId: string): string | null {
  const pref = readAllOverrides()[userId];
  return pref?.dashboardId ?? null;
}

export function writePersonalDashboardHomepageOverride(userId: string, dashboardId: string | null): void {
  if (typeof window === "undefined") return;
  const all = readAllOverrides();
  if (!dashboardId) {
    delete all[userId];
  } else {
    all[userId] = { dashboardId, setAt: new Date().toISOString() };
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function routeForCatalogEntry(
  session: PulseAuthSession | null,
  entry: DashboardCatalogEntry,
): string | null {
  if (!session) return null;
  if (!canAccessClassicNavHref(session, entry.route)) return null;
  return entry.route;
}

function resolveCatalogId(session: PulseAuthSession | null, catalogId: string): string | null {
  const entry = getDashboardCatalogEntry(catalogId);
  if (!entry) return null;
  return routeForCatalogEntry(session, entry);
}

/** Dashboards the user may set as homepage (authorized catalog entries only). */
export function accessibleDashboardsForSession(session: PulseAuthSession | null): DashboardCatalogEntry[] {
  if (!session) return [];
  return DASHBOARD_CATALOG.filter((d) => canAccessClassicNavHref(session, d.route));
}

/**
 * First landing after sign-in: operations dashboard (`/overview`) when allowed so the welcome overlay
 * runs before deep links (e.g. department module homes like work requests).
 */
export function resolvePostLoginLandingPath(session: PulseAuthSession | null): string {
  if (!session) return "/login";
  if (session.is_system_admin || session.role === "system_admin") return "/system";

  if (
    isInventoryScannerOnlySession(session) &&
    canAccessClassicNavHref(session, "/kiosk/inventory-scanner")
  ) {
    return "/kiosk/inventory-scanner";
  }

  const improvementHome = resolveImprovementFocusedModuleHome(session);
  if (improvementHome) {
    return improvementHome;
  }

  if (canAccessClassicNavHref(session, "/overview")) {
    return "/overview";
  }

  const role = sessionPrimaryRole(session);
  if (role === "worker" && canAccessClassicNavHref(session, "/worker")) {
    return "/worker";
  }

  return resolveAssignedDashboardHomepage(session);
}

/**
 * Resolve assigned homepage route: personal override → role default → department default → first accessible dashboard.
 */
export function resolveAssignedDashboardHomepage(session: PulseAuthSession | null): string {
  if (!session) return "/login";
  if (session.is_system_admin || session.role === "system_admin") return "/system";

  const userId = session.sub;
  if (userId && typeof window !== "undefined") {
    const overrideId = readPersonalDashboardHomepageOverride(userId);
    if (overrideId) {
      const route = resolveCatalogId(session, overrideId);
      if (route) return route;
    }
  }

  const improvementHome = resolveImprovementFocusedModuleHome(session);
  if (improvementHome) return improvementHome;

  const dept = (session.hr_department ?? "").trim().toLowerCase();
  if (dept) {
    const moduleHome = DEPARTMENT_MODULE_HOME_ROUTES[dept];
    if (moduleHome && canAccessClassicNavHref(session, moduleHome)) {
      return moduleHome;
    }
    const deptId = DEPARTMENT_DEFAULT_DASHBOARD_ID[dept];
    if (deptId) {
      const route = resolveCatalogId(session, deptId);
      if (route) return route;
    }
  }

  const role = sessionPrimaryRole(session);
  const roleId = ROLE_DEFAULT_DASHBOARD_ID[role];
  if (roleId) {
    const route = resolveCatalogId(session, roleId);
    if (route) return route;
  }

  for (const d of DASHBOARD_CATALOG) {
    const route = routeForCatalogEntry(session, d);
    if (route) return route;
  }

  for (const entry of CONTRACT_MODULE_HOME_ROUTES) {
    if (!tenantHasAnyCompanyModule(session, entry.contractKeys)) continue;
    if (canAccessClassicNavHref(session, entry.route)) return entry.route;
  }

  return "/settings";
}
