/**
 * @deprecated Use {@link MASTER_FEATURES} and {@link tenantSidebarNavItemsForSession}.
 */
import { LEGACY_PLATFORM_ROUTE_ALIASES } from "@/config/platform/legacy-platform-routes";
import { MASTER_FEATURES, NAV_VISIBLE_MASTER_FEATURES } from "@/config/platform/master-feature-registry";
import type { PlatformIconKey } from "@/config/platform/types";
import type { PlatformWorkspaceModuleDef } from "@/lib/rbac/platform-workspace-modules";

function normalizeHref(href: string): string {
  const path = href.split("?")[0] ?? href;
  if (path.endsWith("/") && path.length > 1) return path.slice(0, -1);
  return path;
}

const CLASSIC_TENANT_NAV_ROUTES = new Set(
  NAV_VISIBLE_MASTER_FEATURES.filter((m) => !m.platformRoute).map((m) => normalizeHref(m.route)),
);

export type UnifiedPlatformSidebarItem = {
  href: string;
  label: string;
  icon: PlatformIconKey;
};

/** @deprecated */
export function resolveUnifiedPlatformSidebarItem(
  departmentSlug: string,
  mod: PlatformWorkspaceModuleDef,
): UnifiedPlatformSidebarItem | null {
  const meta = MASTER_FEATURES.find((m) => m.key === mod.id);
  const legacy = LEGACY_PLATFORM_ROUTE_ALIASES.find((r) => r.key === mod.id);
  const canonical = meta?.route ?? legacy?.canonicalRoute ?? null;

  if (canonical) {
    if (CLASSIC_TENANT_NAV_ROUTES.has(normalizeHref(canonical))) return null;
    return { href: canonical, label: mod.name, icon: mod.icon };
  }

  return {
    href: normalizeHref(`/${departmentSlug}/${mod.route}`),
    label: mod.name,
    icon: mod.icon,
  };
}

export function classicTenantNavHrefs(): ReadonlySet<string> {
  return CLASSIC_TENANT_NAV_ROUTES;
}
