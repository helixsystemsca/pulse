import type { PlatformModule } from "@/config/platform/types";

/**
 * Central module registry. Departments *consume* modules via `allowedDepartmentSlugs`
 * and per-department `enabledModuleIds` in `departments.ts`.
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
  },
  {
    id: "mod_publication_builder",
    slug: "publication-builder",
    name: "Publication Builder",
    icon: "newspaper",
    route: "publication-builder",
    allowedDepartmentSlugs: ["communications"],
    requiredCapabilities: ["publications.create"],
  },
  {
    id: "mod_assets",
    slug: "assets",
    name: "Assets",
    icon: "image",
    route: "assets",
    allowedDepartmentSlugs: ["communications"],
    requiredCapabilities: ["communications.assets.view"],
  },
  {
    id: "mod_procedures",
    slug: "procedures",
    name: "Procedures",
    icon: "book-open",
    route: "procedures",
    allowedDepartmentSlugs: ["maintenance", "communications", "aquatics", "fitness", "admin"],
    requiredCapabilities: ["procedures.view"],
    canonicalPulseHref: "/standards",
  },
  {
    id: "mod_analytics",
    slug: "analytics",
    name: "Analytics",
    icon: "bar-chart-2",
    route: "analytics",
    allowedDepartmentSlugs: ["maintenance", "communications", "aquatics", "fitness", "admin"],
    requiredCapabilities: ["analytics.view"],
    canonicalPulseHref: "/dashboard/team-insights",
    suppressCanonicalForDepartments: ["admin"],
  },
  {
    id: "mod_messaging",
    slug: "messaging",
    name: "Messaging",
    icon: "message-square",
    route: "messaging",
    allowedDepartmentSlugs: ["maintenance", "communications", "aquatics", "fitness", "admin"],
    requiredCapabilities: ["messaging.view"],
    canonicalPulseHref: "/dashboard/messages",
  },
  {
    id: "mod_scheduling",
    slug: "scheduling",
    name: "Scheduling",
    icon: "calendar",
    route: "scheduling",
    allowedDepartmentSlugs: ["aquatics"],
    requiredCapabilities: ["aquatics.scheduling.view"],
  },
  {
    id: "mod_classes",
    slug: "classes",
    name: "Classes",
    icon: "layout",
    route: "classes",
    allowedDepartmentSlugs: ["fitness"],
    requiredCapabilities: ["fitness.classes.view"],
  },
] as const;

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
