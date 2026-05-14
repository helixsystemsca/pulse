import { LEGACY_PLATFORM_ROUTE_ALIASES } from "@/config/platform/legacy-platform-routes";
import { MASTER_FEATURES } from "@/config/platform/master-feature-registry";
import type { PlatformModule } from "@/config/platform/types";
import type { PlatformIconKey } from "@/config/platform/types";

function toPlatformIcon(icon: string): PlatformIconKey {
  const allowed: PlatformIconKey[] = [
    "wrench",
    "megaphone",
    "waves",
    "dumbbell",
    "building",
    "clipboard",
    "scroll-text",
    "package",
    "book-open",
    "bar-chart-2",
    "message-square",
    "newspaper",
    "image",
    "calendar",
    "layout",
    "file-text",
    "layout-grid",
  ];
  if (allowed.includes(icon as PlatformIconKey)) return icon as PlatformIconKey;
  return "layout";
}

function masterToPlatformModule(f: (typeof MASTER_FEATURES)[number]): PlatformModule | null {
  if (!f.platformRoute || !f.platformDepartmentSlug) return null;
  return {
    id: f.key,
    slug: f.platformRoute,
    name: f.label,
    icon: toPlatformIcon(f.icon),
    route: f.platformRoute,
    allowedDepartmentSlugs: [f.platformDepartmentSlug],
    canonicalPulseHref: f.route,
    tenantNavFeatureKey: f.feature,
  };
}

function legacyToPlatformModule(r: (typeof LEGACY_PLATFORM_ROUTE_ALIASES)[number]): PlatformModule {
  return {
    id: r.key,
    slug: r.route,
    name: r.key,
    icon: "layout",
    route: r.route,
    allowedDepartmentSlugs: [r.departmentSlug],
    canonicalPulseHref: r.canonicalRoute,
    suppressCanonicalForDepartments: r.suppressCanonicalForDepartments,
    tenantNavFeatureKey: r.feature,
  };
}

/** Platform `/{department}/{module}` metadata (redirects + comms tools). */
export const PLATFORM_MODULES: readonly PlatformModule[] = [
  ...MASTER_FEATURES.map(masterToPlatformModule).filter((m): m is PlatformModule => m !== null),
  ...LEGACY_PLATFORM_ROUTE_ALIASES.map(legacyToPlatformModule),
];

export function moduleIdsForDepartmentSlug(slug: string): readonly string[] {
  return PLATFORM_MODULES.filter((m) => m.allowedDepartmentSlugs.includes(slug)).map((m) => m.id);
}

const byId = new Map(PLATFORM_MODULES.map((m) => [m.id, m]));

export function getPlatformModuleById(id: string): PlatformModule | undefined {
  return byId.get(id);
}

export function getPlatformModuleByDepartmentRoute(
  departmentSlug: string,
  moduleRoute: string,
): PlatformModule | undefined {
  for (const m of PLATFORM_MODULES) {
    if (m.route !== moduleRoute) continue;
    if (!m.allowedDepartmentSlugs.includes(departmentSlug)) continue;
    return m;
  }
  return undefined;
}
