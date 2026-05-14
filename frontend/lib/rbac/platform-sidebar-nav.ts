/**
 * Unified tenant sidebar entries for platform modules.
 * Modules with a canonical Pulse href already represented in the classic rail are omitted
 * (e.g. maintenance work-orders → Work Requests). Department-native tools (communications, etc.)
 * link to `/{department}/{route}` or their canonical href when not in the classic rail.
 */
import { getPlatformModuleById } from "@/config/platform/modules";
import { pulseTenantSidebarNav } from "@/lib/pulse-app";
import type { PlatformIconKey } from "@/config/platform/types";
import type { PulseSidebarIcon } from "@/lib/pulse-app";
import type { PlatformWorkspaceModuleDef } from "@/lib/rbac/platform-workspace-modules";

function normalizeHref(href: string): string {
  const path = href.split("?")[0] ?? href;
  if (path.endsWith("/") && path.length > 1) return path.slice(0, -1);
  return path;
}

const CLASSIC_TENANT_NAV_HREFS = new Set(
  pulseTenantSidebarNav.map((item) => normalizeHref(item.href)),
);

export type UnifiedPlatformSidebarItem = {
  href: string;
  label: string;
  icon: PlatformIconKey | PulseSidebarIcon;
};

/**
 * Resolve a single platform module row for the tenant left rail.
 * Returns null when the module is already covered by classic navigation.
 */
export function resolveUnifiedPlatformSidebarItem(
  departmentSlug: string,
  mod: PlatformWorkspaceModuleDef,
): UnifiedPlatformSidebarItem | null {
  const meta = getPlatformModuleById(mod.id);
  const suppressCanon = meta?.suppressCanonicalForDepartments?.includes(departmentSlug) ?? false;
  const canonical = meta?.canonicalPulseHref && !suppressCanon ? normalizeHref(meta.canonicalPulseHref) : null;

  if (canonical) {
    if (CLASSIC_TENANT_NAV_HREFS.has(canonical)) {
      return null;
    }
    return { href: canonical, label: mod.name, icon: mod.icon };
  }

  return {
    href: normalizeHref(`/${departmentSlug}/${mod.route}`),
    label: mod.name,
    icon: mod.icon,
  };
}

export function classicTenantNavHrefs(): ReadonlySet<string> {
  return CLASSIC_TENANT_NAV_HREFS;
}
