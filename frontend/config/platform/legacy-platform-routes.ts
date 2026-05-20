/**
 * Legacy `/{departmentSlug}/{route}` aliases — redirect to canonical shared product routes.
 * Not used for sidebar composition (see {@link MASTER_FEATURES}).
 */
export type LegacyPlatformRouteAlias = {
  key: string;
  departmentSlug: string;
  route: string;
  feature: string;
  rbacAnyOf: readonly string[];
  canonicalRoute: string;
  suppressCanonicalForDepartments?: readonly string[];
};

export const LEGACY_PLATFORM_ROUTE_ALIASES: readonly LegacyPlatformRouteAlias[] = [
  {
    key: "mod_work_orders",
    departmentSlug: "maintenance",
    route: "work-orders",
    feature: "work_requests",
    rbacAnyOf: ["work_requests.view"],
    canonicalRoute: "/dashboard/maintenance",
  },
  {
    key: "mod_inspections",
    departmentSlug: "maintenance",
    route: "inspections",
    feature: "compliance",
    rbacAnyOf: ["compliance.view"],
    canonicalRoute: "/dashboard/compliance",
  },
  {
    key: "mod_equipment",
    departmentSlug: "maintenance",
    route: "equipment",
    feature: "equipment",
    rbacAnyOf: ["equipment.view"],
    canonicalRoute: "/equipment",
  },
  {
    key: "mod_procedures",
    departmentSlug: "maintenance",
    route: "procedures",
    feature: "procedures",
    rbacAnyOf: ["procedures.view"],
    canonicalRoute: "/standards",
  },
  {
    key: "mod_analytics",
    departmentSlug: "maintenance",
    route: "analytics",
    feature: "team_insights",
    rbacAnyOf: ["team_insights.view"],
    canonicalRoute: "/dashboard/team-insights",
    suppressCanonicalForDepartments: ["admin"],
  },
  {
    key: "mod_messaging",
    departmentSlug: "maintenance",
    route: "messaging",
    feature: "messaging",
    rbacAnyOf: ["messaging.view"],
    canonicalRoute: "/dashboard/messages",
  },
  {
    key: "mod_scheduling",
    departmentSlug: "aquatics",
    route: "scheduling",
    feature: "schedule",
    rbacAnyOf: ["schedule.view"],
    canonicalRoute: "/schedule",
  },
  {
    key: "mod_classes",
    departmentSlug: "fitness",
    route: "classes",
    feature: "schedule",
    rbacAnyOf: ["schedule.view"],
    canonicalRoute: "/schedule",
  },
] as const;

export function getLegacyPlatformRouteAlias(
  departmentSlug: string,
  routeSeg: string,
): LegacyPlatformRouteAlias | undefined {
  return LEGACY_PLATFORM_ROUTE_ALIASES.find(
    (r) => r.departmentSlug === departmentSlug && r.route === routeSeg,
  );
}
