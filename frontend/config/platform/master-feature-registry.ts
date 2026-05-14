/**
 * Master feature registry — single source of truth for tenant product modules.
 *
 * Sidebar, route guards, and platform metadata derive from this file.
 * Visibility: `navVisible` × `tenant.enabled_features` (contract) × RBAC × optional `departmentSlugs`.
 *
 * Departments affect data scoping only — not duplicate applications (no maintenance-prefixed nav).
 */
import type { PlatformIconKey } from "@/config/platform/types";

export type MasterFeatureIcon =
  | PlatformIconKey
  | "activity"
  | "folder-kanban"
  | "list-checks"
  | "sparkles"
  | "user-cog"
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
  /** Company contract key (`/auth/me` `contract_features`). */
  feature: string;
  rbacAnyOf: readonly string[];
  navVisible: boolean;
  /**
   * Optional HR department filter (`/auth/me` `hr_department`).
   * Omit for tenant-wide modules. Tenant full admins bypass.
   */
  departmentSlugs?: readonly string[];
  /** Legacy platform shell: `/{platformDepartmentSlug}/{platformRoute}` → `route`. */
  platformDepartmentSlug?: string;
  platformRoute?: string;
  sortOrder: number;
};

const MAINTENANCE_OPS: readonly string[] = ["maintenance", "reception", "admin"];

/**
 * Globally unique operational features — one row per product module.
 */
export const MASTER_FEATURES: readonly MasterFeatureDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "layout",
    route: "/overview",
    feature: "dashboard",
    rbacAnyOf: ["dashboard.view"],
    navVisible: true,
    sortOrder: 10,
  },
  {
    key: "compliance",
    label: "Inspections & Logs",
    icon: "scroll-text",
    route: "/dashboard/compliance",
    feature: "compliance",
    rbacAnyOf: ["compliance.view"],
    navVisible: true,
    departmentSlugs: MAINTENANCE_OPS,
    sortOrder: 20,
  },
  {
    key: "schedule",
    label: "Schedule",
    icon: "calendar",
    route: "/schedule",
    feature: "schedule",
    rbacAnyOf: ["schedule.view"],
    navVisible: true,
    sortOrder: 30,
  },
  {
    key: "monitoring",
    label: "Monitoring",
    icon: "activity",
    route: "/monitoring",
    feature: "monitoring",
    rbacAnyOf: ["monitoring.view"],
    navVisible: true,
    departmentSlugs: MAINTENANCE_OPS,
    sortOrder: 40,
  },
  {
    key: "projects",
    label: "Projects",
    icon: "folder-kanban",
    route: "/projects",
    feature: "projects",
    rbacAnyOf: ["projects.view"],
    navVisible: true,
    sortOrder: 50,
  },
  {
    key: "work_requests",
    label: "Work Requests",
    icon: "clipboard",
    route: "/dashboard/maintenance",
    feature: "work_requests",
    rbacAnyOf: ["work_requests.view", "work_requests.edit"],
    navVisible: true,
    departmentSlugs: MAINTENANCE_OPS,
    sortOrder: 60,
  },
  {
    key: "procedures",
    label: "Standards",
    icon: "list-checks",
    route: "/standards",
    feature: "procedures",
    rbacAnyOf: ["procedures.view"],
    navVisible: true,
    sortOrder: 70,
  },
  {
    key: "team_insights",
    label: "Team Insights",
    icon: "sparkles",
    route: "/dashboard/team-insights",
    feature: "team_insights",
    rbacAnyOf: ["team_insights.view"],
    navVisible: true,
    sortOrder: 80,
  },
  {
    key: "team_management",
    label: "Team Management",
    icon: "user-cog",
    route: "/dashboard/workers",
    feature: "team_management",
    rbacAnyOf: ["team_management.view"],
    navVisible: true,
    sortOrder: 90,
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: "package",
    route: "/dashboard/inventory",
    feature: "inventory",
    rbacAnyOf: ["inventory.view", "inventory.manage"],
    navVisible: true,
    departmentSlugs: MAINTENANCE_OPS,
    sortOrder: 100,
  },
  {
    key: "equipment",
    label: "Equipment",
    icon: "wrench",
    route: "/equipment",
    feature: "equipment",
    rbacAnyOf: ["equipment.view"],
    navVisible: true,
    departmentSlugs: MAINTENANCE_OPS,
    sortOrder: 110,
  },
  {
    key: "drawings",
    label: "Drawings",
    icon: "layers",
    route: "/drawings",
    feature: "drawings",
    rbacAnyOf: ["drawings.view"],
    navVisible: true,
    sortOrder: 120,
  },
  {
    key: "zones_devices",
    label: "Zones & Devices",
    icon: "map-pin",
    route: "/devices",
    feature: "zones_devices",
    rbacAnyOf: ["zones_devices.view"],
    navVisible: true,
    sortOrder: 130,
  },
  {
    key: "live_map",
    label: "Live Map",
    icon: "radio",
    route: "/live-map",
    feature: "live_map",
    rbacAnyOf: ["live_map.view"],
    navVisible: true,
    sortOrder: 140,
  },
  {
    key: "messaging",
    label: "Messaging",
    icon: "message-square",
    route: "/dashboard/messages",
    feature: "messaging",
    rbacAnyOf: ["messaging.view"],
    navVisible: true,
    sortOrder: 150,
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
  },
  {
    key: "comms_advertising_mapper",
    label: "Arena Advertising",
    icon: "layout-grid",
    route: "/communications/advertising-mapper",
    feature: "comms_advertising_mapper",
    rbacAnyOf: ["arena_advertising.view"],
    navVisible: true,
    departmentSlugs: ["communications"],
    platformDepartmentSlug: "communications",
    platformRoute: "advertising-mapper",
    sortOrder: 200,
  },
  {
    key: "comms_publication_builder",
    label: "Publication pipeline",
    icon: "newspaper",
    route: "/communications/publication-builder",
    feature: "comms_publication_builder",
    rbacAnyOf: ["publication_pipeline.view"],
    navVisible: true,
    departmentSlugs: ["communications"],
    platformDepartmentSlug: "communications",
    platformRoute: "publication-builder",
    sortOrder: 210,
  },
  {
    key: "comms_indesign_pipeline",
    label: "Xplor → InDesign",
    icon: "file-text",
    route: "/communications/indesign-pipeline",
    feature: "comms_indesign_pipeline",
    rbacAnyOf: ["xplor_indesign.view"],
    navVisible: true,
    departmentSlugs: ["communications"],
    platformDepartmentSlug: "communications",
    platformRoute: "indesign-pipeline",
    sortOrder: 220,
  },
  {
    key: "comms_campaign_planner",
    label: "Social Planner",
    icon: "calendar",
    route: "/communications/campaign-planner",
    feature: "comms_campaign_planner",
    rbacAnyOf: ["social_planner.view"],
    navVisible: true,
    departmentSlugs: ["communications"],
    platformDepartmentSlug: "communications",
    platformRoute: "campaign-planner",
    sortOrder: 230,
  },
  {
    key: "comms_assets",
    label: "Assets",
    icon: "image",
    route: "/communications/assets",
    feature: "comms_assets",
    rbacAnyOf: ["communications_assets.view"],
    navVisible: true,
    departmentSlugs: ["communications"],
    platformDepartmentSlug: "communications",
    platformRoute: "assets",
    sortOrder: 240,
  },
] as const;

const byKey = new Map(MASTER_FEATURES.map((f) => [f.key, f]));
const byRoute = new Map(MASTER_FEATURES.map((f) => [normalizeFeatureRoute(f.route), f]));

function normalizeFeatureRoute(route: string): string {
  const path = route.split("?")[0] ?? route;
  if (path.endsWith("/") && path.length > 1) return path.slice(0, -1);
  return path;
}

export function getMasterFeatureByKey(key: string): MasterFeatureDef | undefined {
  return byKey.get(key);
}

export function getMasterFeatureByRoute(route: string): MasterFeatureDef | undefined {
  return byRoute.get(normalizeFeatureRoute(route));
}

/** Longest-prefix match for route guards (e.g. `/standards/procedures` → procedures feature). */
export function getMasterFeatureForPath(pathname: string): MasterFeatureDef | undefined {
  const h = normalizeFeatureRoute(pathname);
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
