/**
 * Master feature registry — single source of truth for tenant product modules.
 *
 * Authorization: registry → tenant contract → `enabled_features` (matrix ∪ overlays) → RBAC.
 * Presentation fields (`navDomain`, `navGroup`, `dashboardScope`, …) are never used for access checks.
 */
import type { DashboardScope } from "@/config/platform/dashboard-scope";
import {
  DASHBOARD_ACCESS_REGISTRY,
  dashboardRbacAnyOf,
  enabledFeatureKeyForDashboard,
} from "@/lib/dashboards/dashboard-permissions";
import type { ModuleCategory } from "@/config/platform/module-categories";
import type { NavDomain } from "@/config/platform/nav-domains";
import type { PlatformIconKey } from "@/config/platform/types";

/** Department blank dashboards appear in the owning workflow domain (Communications, Aquatics, …). */
function navDomainForDepartmentDashboard(ownershipDepartment?: string): NavDomain {
  const slug = (ownershipDepartment ?? "").trim().toLowerCase();
  const map: Record<string, NavDomain> = {
    communications: "Communications",
    aquatics: "Aquatics",
    reception: "Reception",
    fitness: "Fitness",
    racquets: "Racquets",
    admin: "Administration",
  };
  return map[slug] ?? "Dashboards";
}

export type MasterFeatureIcon =
  | PlatformIconKey
  | "activity"
  | "folder-kanban"
  | "list-checks"
  | "sparkles"
  | "user-cog"
  | "users"
  | "map-pin"
  | "radio"
  | "settings"
  | "layers";

export type MasterFeatureDef = {
  /** Stable feature id (globally unique). */
  key: string;
  label: string;
  icon: MasterFeatureIcon;
  /** Canonical application route (one module, one route). */
  route: string;
  /** Canonical feature key (`/auth/me` `enabled_features`). */
  feature: string;
  rbacAnyOf: readonly string[];
  navVisible: boolean;
  /** Legacy platform shell: `/{platformDepartmentSlug}/{platformRoute}` → `route`. */
  platformDepartmentSlug?: string;
  platformRoute?: string;
  sortOrder: number;
  /**
   * Sidebar section label (presentation only). Omitted → {@link DEFAULT_MODULE_CATEGORY}.
   * @deprecated Prefer {@link navDomain} + {@link navGroup}.
   */
  moduleCategory?: ModuleCategory;
  /** Workflow-oriented top-level sidebar domain (presentation only). */
  navDomain: NavDomain;
  /** Flyout subsection label within {@link navDomain} (presentation only). */
  navGroup?: string;
  /** Sort order within nav group / domain (presentation only). Falls back to {@link sortOrder}. */
  navOrder?: number;
  /** Optional sidebar/flyout label override (presentation only). */
  navLabelOverride?: string;
  /** Dashboard scope for dashboard surfaces (presentation only). */
  dashboardScope?: DashboardScope;
  /**
   * Department that owns/configures a department-scoped dashboard (presentation only).
   * Example: maintenance dashboards remain owned by maintenance while using shared dashboard infrastructure.
   */
  ownershipDepartment?: string;
  /** When true, row is a navigation alias (same permission feature may appear in multiple domains). */
  navAlias?: boolean;
};

/**
 * Globally unique operational features — one row per product module or navigation alias.
 */
export const MASTER_FEATURES: readonly MasterFeatureDef[] = [
  // —— Dashboards ——
  {
    key: "dashboard",
    label: "Leadership dashboard",
    icon: "layout",
    route: "/overview",
    feature: "dashboard_leadership",
    rbacAnyOf: [...dashboardRbacAnyOf("dashboard.leadership.view")],
    navVisible: true,
    sortOrder: 10,
    navDomain: "Dashboards",
    navGroup: "Shared Dashboards",
    navOrder: 10,
    dashboardScope: "organization",
  },
  {
    key: "dashboard_worker",
    label: "Operations dashboard",
    icon: "layout",
    route: "/worker",
    feature: "dashboard_operations",
    rbacAnyOf: [...dashboardRbacAnyOf("dashboard.operations.view")],
    navVisible: true,
    sortOrder: 11,
    navDomain: "Dashboards",
    navGroup: "My Dashboards",
    navOrder: 15,
    dashboardScope: "personal",
    navAlias: true,
  },
  {
    key: "dashboard_project",
    label: "Project dashboard",
    icon: "folder-kanban",
    route: "/overview/project",
    feature: "dashboard_project",
    rbacAnyOf: [...dashboardRbacAnyOf("dashboard.project.view"), "projects.view"],
    navVisible: true,
    sortOrder: 12,
    navDomain: "Dashboards",
    navGroup: "Project Dashboards",
    navOrder: 20,
    dashboardScope: "project",
    navAlias: true,
  },
  {
    key: "monitoring",
    label: "Monitoring",
    icon: "activity",
    route: "/monitoring",
    feature: "monitoring",
    rbacAnyOf: ["monitoring.view"],
    navVisible: true,
    sortOrder: 20,
    navDomain: "Operations",
    navGroup: "Monitoring",
    navOrder: 25,
    dashboardScope: "shared",
  },
  {
    key: "logs_inspections",
    label: "Logs & Inspections",
    icon: "scroll-text",
    route: "/dashboard/compliance",
    feature: "logs_inspections",
    rbacAnyOf: ["compliance.view"],
    navVisible: true,
    sortOrder: 40,
    navDomain: "Operations",
    navGroup: "Logs & Inspections",
    navOrder: 10,
    dashboardScope: "department",
    ownershipDepartment: "maintenance",
  },
  {
    key: "logs_inspections_dashboard",
    label: "Inspections & Logs",
    icon: "scroll-text",
    route: "/dashboard/compliance",
    feature: "logs_inspections",
    rbacAnyOf: [...dashboardRbacAnyOf("dashboard.inspections.view"), "compliance.view"],
    navVisible: false,
    sortOrder: 41,
    navDomain: "Dashboards",
    navGroup: "Department Dashboards",
    navOrder: 50,
    dashboardScope: "department",
    ownershipDepartment: "maintenance",
    navAlias: true,
  },
  {
    key: "work_requests",
    label: "Work Requests",
    icon: "clipboard",
    route: "/dashboard/maintenance",
    feature: "work_requests",
    rbacAnyOf: ["work_requests.view", "work_requests.edit"],
    navVisible: true,
    sortOrder: 50,
    navDomain: "Operations",
    navGroup: "Work Requests",
    navOrder: 5,
    dashboardScope: "department",
    ownershipDepartment: "maintenance",
  },
  ...DASHBOARD_ACCESS_REGISTRY.filter((d) => d.id.startsWith("dashboard_dept_")).map((d) => ({
    key: d.id,
    label: d.label,
    icon: d.icon,
    route: d.route,
    feature: enabledFeatureKeyForDashboard(d),
    rbacAnyOf: [...dashboardRbacAnyOf(d.viewPermission)],
    navVisible: true,
    sortOrder: d.sortOrder,
    navDomain: navDomainForDepartmentDashboard(d.ownershipDepartment),
    navGroup: "Dashboard",
    navOrder: 5,
    dashboardScope: "department" as const,
    ownershipDepartment: d.ownershipDepartment,
    navAlias: true,
  })),

  // —— Planning ——
  {
    key: "planning_workspace",
    label: "Planning",
    icon: "calendar",
    route: "/planning",
    feature: "projects",
    rbacAnyOf: ["projects.view"],
    navVisible: false,
    sortOrder: 99,
    navDomain: "Planning",
    navGroup: "Projects",
    navOrder: 15,
    navAlias: true,
  },
  {
    key: "schedule",
    label: "Schedule",
    icon: "calendar",
    route: "/schedule",
    feature: "schedule",
    rbacAnyOf: ["schedule.view"],
    navVisible: true,
    sortOrder: 100,
    navDomain: "Planning",
    navGroup: "Scheduling",
    navOrder: 10,
  },
  {
    key: "schedule_availability",
    label: "Availability",
    icon: "calendar",
    route: "/schedule/availability",
    feature: "schedule_availability",
    rbacAnyOf: ["schedule.view"],
    navVisible: false,
    sortOrder: 101,
    navDomain: "Planning",
    navGroup: "Scheduling",
    navOrder: 20,
    navAlias: true,
  },
  {
    key: "schedule_coverage",
    label: "Coverage",
    icon: "calendar",
    route: "/schedule/availability-grid",
    feature: "schedule_coverage",
    rbacAnyOf: ["schedule.view"],
    navVisible: false,
    sortOrder: 102,
    navDomain: "Planning",
    navGroup: "Scheduling",
    navOrder: 30,
    navAlias: true,
  },
  {
    key: "schedule_shift_definitions",
    label: "Shift definitions",
    icon: "calendar",
    route: "/schedule/shift-definitions",
    feature: "schedule_shift_definitions",
    rbacAnyOf: ["schedule.view"],
    navVisible: false,
    sortOrder: 103,
    navDomain: "Planning",
    navGroup: "Scheduling",
    navOrder: 40,
    navAlias: true,
  },
  {
    key: "projects",
    label: "Projects",
    icon: "folder-kanban",
    route: "/projects",
    feature: "projects",
    rbacAnyOf: ["projects.view"],
    navVisible: true,
    sortOrder: 110,
    navDomain: "Planning",
    navGroup: "Projects",
    navOrder: 10,
  },
  {
    key: "pm_workspace",
    label: "PM workspace",
    icon: "folder-kanban",
    route: "/dashboard/pm-workspace",
    feature: "pm_workspace",
    rbacAnyOf: ["projects.pm.view"],
    navVisible: false,
    sortOrder: 111,
    navDomain: "Planning",
    navGroup: "Projects",
    navOrder: 20,
    navAlias: true,
  },
  {
    key: "pm_planning",
    label: "PM planning",
    icon: "folder-kanban",
    route: "/pm/planning",
    feature: "pm_planning",
    rbacAnyOf: ["projects.pm.view"],
    navVisible: false,
    sortOrder: 112,
    navDomain: "Planning",
    navGroup: "Projects",
    navOrder: 30,
    navAlias: true,
  },
  {
    key: "project_management",
    label: "Project Management",
    icon: "folder-kanban",
    route: "/project-management",
    feature: "project_management",
    rbacAnyOf: ["projects.pm.view"],
    navVisible: true,
    sortOrder: 111,
    navDomain: "Planning",
    navGroup: "Projects",
    navOrder: 20,
    navAlias: true,
  },
  {
    key: "comms_campaign_planner",
    label: "Social Planner",
    icon: "calendar",
    route: "/communications/campaign-planner",
    feature: "comms_campaign_planner",
    rbacAnyOf: ["social_planner.view"],
    navVisible: true,
    platformDepartmentSlug: "communications",
    platformRoute: "campaign-planner",
    sortOrder: 120,
    moduleCategory: "Communications",
    navDomain: "Communications",
    navGroup: "Campaigns",
    navOrder: 40,
  },

  // —— Operations ——
  {
    key: "standards_routines",
    label: "Routines",
    icon: "list-checks",
    route: "/standards/routines",
    feature: "standards_routines",
    rbacAnyOf: ["procedures.view"],
    navVisible: true,
    sortOrder: 200,
    navDomain: "Operations",
    navGroup: "Routines",
    navOrder: 10,
    navAlias: true,
  },
  {
    key: "messaging",
    label: "Messaging",
    icon: "message-square",
    route: "/dashboard/messages",
    feature: "messaging",
    rbacAnyOf: ["messaging.view"],
    navVisible: true,
    sortOrder: 210,
    navDomain: "Operations",
    navGroup: "Communications",
    navOrder: 30,
  },

  // —— Training (workforce learning + compliance) ——
  {
    key: "training_root",
    label: "Training",
    icon: "book-open",
    route: "/training",
    feature: "standards_training",
    rbacAnyOf: [
      "standards.training.view",
      "standards.training.overview.view",
      "standards.training.workers.view",
      "standards.training.certifications.view",
      "standards.training.compliance.view",
      "standards.training.expiring.view",
      "standards.certifications.view",
      "standards.compliance.view",
      "procedures.view",
    ],
    navVisible: false,
    sortOrder: 300,
    navDomain: "Training",
    navGroup: "Training",
    navOrder: 0,
  },
  {
    key: "training_overview",
    label: "Overview",
    icon: "layout",
    route: "/training/overview",
    feature: "standards_training",
    rbacAnyOf: [
      "standards.training.view",
      "standards.training.overview.view",
      "standards.certifications.view",
      "standards.compliance.view",
      "procedures.view",
    ],
    navVisible: true,
    sortOrder: 301,
    navDomain: "Training",
    navGroup: "Training",
    navOrder: 10,
  },
  {
    key: "training_learning",
    label: "Learning",
    icon: "book-open",
    route: "/training/learning",
    feature: "procedures",
    rbacAnyOf: ["procedures.view", "standards.compliance.view"],
    navVisible: true,
    sortOrder: 302,
    navDomain: "Training",
    navGroup: "Training",
    navOrder: 20,
  },
  {
    key: "training_compliance",
    label: "Compliance",
    icon: "list-checks",
    route: "/training/compliance",
    feature: "standards_compliance",
    rbacAnyOf: [
      "standards.compliance.view",
      "standards.training.compliance.view",
      "standards.training.workers.view",
      "standards.training.certifications.view",
      "standards.training.expiring.view",
    ],
    navVisible: true,
    sortOrder: 303,
    navDomain: "Training",
    navGroup: "Training",
    navOrder: 30,
  },
  /** Legacy registry rows — routes redirect to Training domain; hidden from sidebar. */
  {
    key: "procedures",
    label: "Standards",
    icon: "list-checks",
    route: "/standards",
    feature: "procedures",
    rbacAnyOf: ["procedures.view"],
    navVisible: false,
    sortOrder: 310,
    navDomain: "Training",
    navGroup: "Learning",
    navOrder: 0,
    navAlias: true,
  },
  {
    key: "standards_procedures",
    label: "Procedures",
    icon: "list-checks",
    route: "/standards/procedures",
    feature: "procedures",
    rbacAnyOf: ["procedures.view"],
    navVisible: false,
    sortOrder: 311,
    navDomain: "Training",
    navGroup: "Learning",
    navOrder: 10,
    navAlias: true,
  },
  {
    key: "standards_training",
    label: "Training (legacy)",
    icon: "book-open",
    route: "/standards/training",
    feature: "standards_training",
    rbacAnyOf: [
      "standards.training.view",
      "standards.training.overview.view",
      "standards.training.workers.view",
      "standards.training.certifications.view",
      "standards.training.compliance.view",
      "standards.training.expiring.view",
      "standards.certifications.view",
      "standards.compliance.view",
      "procedures.view",
    ],
    navVisible: false,
    sortOrder: 312,
    navDomain: "Training",
    navGroup: "Training",
    navOrder: 90,
    navAlias: true,
  },
  {
    key: "standards_certifications",
    label: "Certifications",
    icon: "scroll-text",
    route: "/standards/training/certifications",
    feature: "standards_certifications",
    rbacAnyOf: ["standards.certifications.view", "standards.training.certifications.view", "procedures.view"],
    navVisible: false,
    sortOrder: 313,
    navDomain: "Training",
    navGroup: "Compliance",
    navOrder: 20,
    navAlias: true,
  },
  {
    key: "standards_compliance",
    label: "Compliance (legacy)",
    icon: "scroll-text",
    route: "/standards/training/compliance",
    feature: "standards_compliance",
    rbacAnyOf: ["standards.compliance.view", "standards.training.compliance.view", "procedures.view"],
    navVisible: false,
    sortOrder: 314,
    navDomain: "Training",
    navGroup: "Compliance",
    navOrder: 30,
    navAlias: true,
  },
  {
    key: "standards_acknowledgments",
    label: "Acknowledgment archive",
    icon: "scroll-text",
    route: "/standards/acknowledgments",
    feature: "standards_acknowledgments",
    rbacAnyOf: ["standards.compliance.view", "procedures.view"],
    navVisible: false,
    sortOrder: 315,
    navDomain: "Training",
    navGroup: "Learning",
    navOrder: 30,
    navAlias: true,
  },
  {
    key: "standards_my_procedures",
    label: "My procedures",
    icon: "list-checks",
    route: "/standards/my-procedures",
    feature: "standards_my_procedures",
    rbacAnyOf: ["procedures.view"],
    navVisible: false,
    sortOrder: 316,
    navDomain: "Training",
    navGroup: "Learning",
    navOrder: 20,
    dashboardScope: "personal",
    navAlias: true,
  },

  // —— Assets ——
  {
    key: "inventory",
    label: "Inventory",
    icon: "package",
    route: "/dashboard/inventory",
    feature: "inventory",
    rbacAnyOf: ["inventory.view", "inventory.manage"],
    navVisible: true,
    sortOrder: 400,
    navDomain: "Assets",
    navGroup: "Inventory",
    navOrder: 10,
  },
  {
    key: "equipment",
    label: "Equipment",
    icon: "wrench",
    route: "/equipment",
    feature: "equipment",
    rbacAnyOf: ["equipment.view"],
    navVisible: true,
    sortOrder: 410,
    navDomain: "Assets",
    navGroup: "Equipment",
    navOrder: 20,
  },
  {
    key: "zones_devices",
    label: "Zones & Devices",
    icon: "map-pin",
    route: "/devices",
    feature: "zones_devices",
    rbacAnyOf: ["zones_devices.view"],
    navVisible: true,
    sortOrder: 430,
    navDomain: "Assets",
    navGroup: "Zones & Devices",
    navOrder: 40,
  },

  // —— Visuals ——
  {
    key: "drawings",
    label: "Spatial",
    icon: "layers",
    route: "/drawings",
    feature: "drawings",
    rbacAnyOf: ["drawings.view"],
    navVisible: true,
    sortOrder: 500,
    navDomain: "Visuals",
    navGroup: "Spatial",
    navOrder: 10,
  },
  {
    key: "spatial_infrastructure",
    label: "Infrastructure maps",
    icon: "layers",
    route: "/drawings?workspace=infrastructure",
    feature: "spatial_infrastructure",
    rbacAnyOf: ["drawings.view"],
    navVisible: true,
    sortOrder: 501,
    navDomain: "Visuals",
    navGroup: "Infrastructure",
    navOrder: 20,
    navAlias: true,
  },
  {
    key: "facilities_spatial",
    label: "Facilities",
    icon: "building",
    route: "/drawings?workspace=facilities",
    feature: "facilities_spatial",
    rbacAnyOf: ["drawings.view"],
    navVisible: true,
    sortOrder: 505,
    navDomain: "Visuals",
    navGroup: "Facilities",
    navOrder: 25,
    navAlias: true,
  },
  {
    key: "live_map",
    label: "Live Map",
    icon: "radio",
    route: "/live-map",
    feature: "live_map",
    rbacAnyOf: ["live_map.view"],
    navVisible: true,
    sortOrder: 510,
    navDomain: "Visuals",
    navGroup: "Live presence",
    navOrder: 30,
  },
  {
    key: "advertising_mapper",
    label: "Arena Advertising",
    icon: "layout-grid",
    route: "/drawings?workspace=advertising",
    feature: "advertising_mapper",
    rbacAnyOf: ["arena_advertising.view"],
    navVisible: true,
    platformDepartmentSlug: "communications",
    platformRoute: "advertising-mapper",
    sortOrder: 520,
    moduleCategory: "Communications",
    navDomain: "Communications",
    navGroup: "Advertising",
    navOrder: 40,
  },
  {
    key: "xplor_indesign",
    label: "Xplor → InDesign",
    icon: "file-text",
    route: "/communications/indesign-pipeline",
    feature: "xplor_indesign",
    rbacAnyOf: ["xplor_indesign.view"],
    navVisible: true,
    platformDepartmentSlug: "communications",
    platformRoute: "indesign-pipeline",
    sortOrder: 540,
    moduleCategory: "Communications",
    navDomain: "Communications",
    navGroup: "Publications",
    navOrder: 60,
  },
  {
    key: "comms_assets",
    label: "Media assets",
    icon: "image",
    route: "/communications/assets",
    feature: "comms_assets",
    rbacAnyOf: ["communications_assets.view"],
    navVisible: true,
    platformDepartmentSlug: "communications",
    platformRoute: "assets",
    sortOrder: 550,
    moduleCategory: "Communications",
    navDomain: "Communications",
    navGroup: "Assets",
    navOrder: 70,
  },

  // —— Team Management (workforce operations) ——
  {
    key: "workforce_hub",
    label: "Overview",
    icon: "users",
    route: "/team-management",
    feature: "team_management",
    rbacAnyOf: ["team_management.view"],
    navVisible: true,
    sortOrder: 580,
    navDomain: "Team Management",
    navGroup: "Workforce",
    navOrder: 0,
  },
  {
    key: "workforce_insights",
    label: "Team Insights",
    icon: "sparkles",
    route: "/team-management/insights",
    feature: "team_insights",
    rbacAnyOf: [...dashboardRbacAnyOf("dashboard.team_insights.view"), "team_insights.view"],
    navVisible: true,
    sortOrder: 585,
    navDomain: "Team Management",
    navGroup: "Workforce",
    navOrder: 10,
    dashboardScope: "department",
    ownershipDepartment: "maintenance",
  },
  {
    key: "workforce_hiring",
    label: "Hiring",
    icon: "clipboard",
    route: "/team-management/hiring",
    feature: "team_management",
    rbacAnyOf: ["team_management.view"],
    navVisible: true,
    sortOrder: 590,
    navDomain: "Team Management",
    navGroup: "Workforce",
    navOrder: 20,
  },
  {
    key: "workforce_development",
    label: "Development",
    icon: "activity",
    route: "/team-management/development",
    feature: "team_management",
    rbacAnyOf: ["team_management.view"],
    navVisible: true,
    sortOrder: 595,
    navDomain: "Team Management",
    navGroup: "Workforce",
    navOrder: 30,
  },
  {
    key: "workforce_onboarding",
    label: "Onboarding",
    icon: "list-checks",
    route: "/team-management/onboarding",
    feature: "team_management",
    rbacAnyOf: ["team_management.view"],
    navVisible: true,
    sortOrder: 600,
    navDomain: "Team Management",
    navGroup: "Workforce",
    navOrder: 40,
  },
  {
    key: "workforce_recognition",
    label: "Recognition",
    icon: "sparkles",
    route: "/team-management/recognition",
    feature: "team_management",
    rbacAnyOf: ["team_management.view"],
    navVisible: true,
    sortOrder: 605,
    navDomain: "Team Management",
    navGroup: "Workforce",
    navOrder: 50,
  },
  {
    key: "workforce_planning",
    label: "Workforce Planning",
    icon: "calendar",
    route: "/team-management/workforce-planning",
    feature: "team_management",
    rbacAnyOf: ["team_management.view"],
    navVisible: true,
    sortOrder: 610,
    navDomain: "Team Management",
    navGroup: "Workforce",
    navOrder: 60,
  },
  {
    key: "workforce_coordination",
    label: "Coordination",
    icon: "clipboard",
    route: "/team-management/coordination",
    feature: "team_management",
    rbacAnyOf: ["team_management.view"],
    navVisible: true,
    sortOrder: 615,
    navDomain: "Team Management",
    navGroup: "Workforce",
    navOrder: 70,
  },

  // —— Administration ——
  {
    key: "permissions",
    label: "Permissions",
    icon: "user-cog",
    route: "/dashboard/permissions",
    feature: "team_management",
    rbacAnyOf: ["team_management.view"],
    navVisible: true,
    sortOrder: 620,
    navDomain: "Administration",
    navGroup: "People",
    navOrder: 10,
  },
  {
    key: "settings",
    label: "Settings",
    icon: "settings",
    route: "/settings",
    feature: "dashboard",
    rbacAnyOf: [],
    navVisible: true,
    sortOrder: 1000,
    navDomain: "Administration",
    navGroup: "Configuration",
    navOrder: 90,
  },
] as const;

const byKey = new Map(MASTER_FEATURES.map((f) => [f.key, f]));

function normalizeFeatureRoute(route: string): string {
  const path = route.split("?")[0] ?? route;
  if (path.endsWith("/") && path.length > 1) return path.slice(0, -1);
  return path;
}

/** Identity for nav deduplication — preserves query strings when present. */
export function normalizeNavHref(href: string): string {
  const [path, query] = href.split("?");
  const base = normalizeFeatureRoute(path ?? href);
  return query ? `${base}?${query}` : base;
}

const byRoute = new Map(MASTER_FEATURES.map((f) => [normalizeNavHref(f.route), f]));

export function getMasterFeatureByKey(key: string): MasterFeatureDef | undefined {
  return byKey.get(key);
}

export function getMasterFeatureByRoute(route: string): MasterFeatureDef | undefined {
  return byRoute.get(normalizeNavHref(route));
}

/** Longest-prefix match for route guards (e.g. `/standards/procedures` → procedures feature). */
export function getMasterFeatureForPath(pathname: string): MasterFeatureDef | undefined {
  const [pathPart, queryPart] = pathname.split("?");
  const h = normalizeFeatureRoute(pathPart ?? pathname);
  const withQuery = queryPart ? `${h}?${queryPart}` : h;

  const exact = byRoute.get(withQuery) ?? byRoute.get(h);
  if (exact) return exact;

  let best: MasterFeatureDef | undefined;
  let bestLen = -1;
  for (const f of MASTER_FEATURES) {
    const r = normalizeFeatureRoute(f.route);
    if (h === r || h.startsWith(`${r}/`)) {
      if (r.length > bestLen) {
        bestLen = r.length;
        best = f;
      }
    }
  }
  return best;
}

export const NAV_VISIBLE_MASTER_FEATURES = MASTER_FEATURES.filter((f) => f.navVisible);
