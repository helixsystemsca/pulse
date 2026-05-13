import type { PlatformModule } from "@/config/platform/types";

/**
 * Central module registry. Departments consume modules via `allowedDepartmentSlugs`
 * (see {@link moduleIdsForDepartmentSlug} and `departments.ts`).
 */
export const PLATFORM_MODULES: readonly PlatformModule[] = [
  {
    id: "mod_work_orders",
    slug: "work-orders",
    name: "Work Orders",
    icon: "clipboard",
    route: "work-orders",
    allowedDepartmentSlugs: ["maintenance"],
    requiredCapabilities: ["workorders.view"],
    canonicalPulseHref: "/dashboard/maintenance",
    tenantNavFeatureKey: "work_requests",
  },
  {
    id: "mod_inspections",
    slug: "inspections",
    name: "Inspections",
    icon: "scroll-text",
    route: "inspections",
    allowedDepartmentSlugs: ["maintenance"],
    requiredCapabilities: ["inspections.view"],
    canonicalPulseHref: "/dashboard/compliance",
    tenantNavFeatureKey: "compliance",
  },
  {
    id: "mod_equipment",
    slug: "equipment",
    name: "Equipment",
    icon: "package",
    route: "equipment",
    allowedDepartmentSlugs: ["maintenance"],
    requiredCapabilities: ["equipment.view"],
    canonicalPulseHref: "/equipment",
    tenantNavFeatureKey: "equipment",
  },
  {
    id: "mod_advertising_mapper",
    slug: "advertising-mapper",
    name: "Advertising mapper",
    icon: "layout-grid",
    route: "advertising-mapper",
    allowedDepartmentSlugs: ["communications"],
    requiredCapabilities: ["communications.advertising_mapper.view"],
    tenantNavFeatureKey: "comms_advertising_mapper",
  },
  {
    id: "mod_publication_builder",
    slug: "publication-builder",
    name: "Publication pipeline",
    icon: "newspaper",
    route: "publication-builder",
    allowedDepartmentSlugs: ["communications"],
    requiredCapabilities: ["publications.create"],
    tenantNavFeatureKey: "comms_publication_builder",
  },
  {
    id: "mod_indesign_pipeline",
    slug: "indesign-pipeline",
    name: "RTF / TXT → InDesign",
    icon: "file-text",
    route: "indesign-pipeline",
    allowedDepartmentSlugs: ["communications"],
    requiredCapabilities: ["communications.indesign_pipeline.view"],
    tenantNavFeatureKey: "comms_indesign_pipeline",
  },
  {
    id: "mod_campaign_planner",
    slug: "campaign-planner",
    name: "Campaign planner",
    icon: "calendar",
    route: "campaign-planner",
    allowedDepartmentSlugs: ["communications"],
    requiredCapabilities: ["communications.campaign_planner.view"],
    tenantNavFeatureKey: "comms_campaign_planner",
  },
  {
    id: "mod_assets",
    slug: "assets",
    name: "Assets",
    icon: "image",
    route: "assets",
    allowedDepartmentSlugs: ["communications"],
    requiredCapabilities: ["communications.assets.view"],
    tenantNavFeatureKey: "comms_assets",
  },
  {
    id: "mod_procedures",
    slug: "procedures",
    name: "Procedures",
    icon: "book-open",
    route: "procedures",
    allowedDepartmentSlugs: ["maintenance", "reception", "communications", "aquatics", "fitness", "racquets", "admin"],
    requiredCapabilities: ["procedures.view"],
    canonicalPulseHref: "/standards",
    tenantNavFeatureKey: "procedures",
  },
  {
    id: "mod_analytics",
    slug: "analytics",
    name: "Analytics",
    icon: "bar-chart-2",
    route: "analytics",
    allowedDepartmentSlugs: ["maintenance", "reception", "communications", "aquatics", "fitness", "racquets", "admin"],
    requiredCapabilities: ["analytics.view"],
    canonicalPulseHref: "/dashboard/team-insights",
    suppressCanonicalForDepartments: ["admin"],
    tenantNavFeatureKey: "team_insights",
  },
  {
    id: "mod_messaging",
    slug: "messaging",
    name: "Messaging",
    icon: "message-square",
    route: "messaging",
    allowedDepartmentSlugs: ["maintenance", "reception", "communications", "aquatics", "fitness", "racquets", "admin"],
    canonicalPulseHref: "/dashboard/messages",
    tenantNavFeatureKey: "messaging",
  },
  {
    id: "mod_scheduling",
    slug: "scheduling",
    name: "Scheduling",
    icon: "calendar",
    route: "scheduling",
    allowedDepartmentSlugs: ["aquatics"],
    requiredCapabilities: ["aquatics.scheduling.view"],
    tenantNavFeatureKey: "schedule",
  },
  {
    id: "mod_classes",
    slug: "classes",
    name: "Classes",
    icon: "layout",
    route: "classes",
    allowedDepartmentSlugs: ["fitness", "racquets"],
    requiredCapabilities: ["fitness.classes.view"],
    tenantNavFeatureKey: "schedule",
  },
] as const;

/** Module ids allowed for a department hub — mirrors {@link PLATFORM_MODULES} `allowedDepartmentSlugs` (single registry). */
export function moduleIdsForDepartmentSlug(slug: string): readonly string[] {
  return PLATFORM_MODULES.filter((m) => m.allowedDepartmentSlugs.includes(slug)).map((m) => m.id);
}

const byId = new Map(PLATFORM_MODULES.map((m) => [m.id, m]));

export function getPlatformModuleById(id: string): PlatformModule | undefined {
  return byId.get(id);
}

export function getPlatformModuleByDepartmentRoute(departmentSlug: string, moduleRoute: string): PlatformModule | undefined {
  for (const m of PLATFORM_MODULES) {
    if (m.route !== moduleRoute) continue;
    if (!m.allowedDepartmentSlugs.includes(departmentSlug)) continue;
    return m;
  }
  return undefined;
}
