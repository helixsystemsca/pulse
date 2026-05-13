import { getDepartmentBySlug, PLATFORM_DEPARTMENTS } from "@/config/platform/departments";
import { PLATFORM_MODULES } from "@/config/platform/modules";
import { hasCapability, resolveCapabilitiesFromSession } from "@/config/platform/permissions";
import type { Department, PlatformNavItem } from "@/config/platform/types";
import type { PulseAuthSession } from "@/lib/pulse-session";

const STORAGE_LAST_DEPT = "pulse_platform_department_slug_v1";

export function readStoredDepartmentSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_LAST_DEPT);
    return v && getDepartmentBySlug(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeStoredDepartmentSlug(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_LAST_DEPT, slug);
  } catch {
    /* ignore */
  }
}

export function getDefaultModuleRouteForDepartment(departmentSlug: string, session: PulseAuthSession | null): string | null {
  const items = buildDepartmentNavItems(departmentSlug, session);
  const first = items[0]?.href;
  if (!first) return null;
  const parts = first.split("/").filter(Boolean);
  return parts[1] ?? null;
}

/**
 * Sidebar items for the department workspace rail: enabled modules ∩ allowed slugs ∩ capabilities.
 * Order follows `PLATFORM_MODULES` declaration order for predictable UX.
 */
export function buildDepartmentNavItems(departmentSlug: string, session: PulseAuthSession | null): PlatformNavItem[] {
  const dept = getDepartmentBySlug(departmentSlug);
  if (!dept) return [];
  const caps = resolveCapabilitiesFromSession(session);
  const enabledIds = new Set(dept.enabledModuleIds);
  const items: PlatformNavItem[] = [];

  for (const mod of PLATFORM_MODULES) {
    if (!enabledIds.has(mod.id)) continue;
    if (!mod.allowedDepartmentSlugs.includes(dept.slug)) continue;
    const reqs = mod.requiredCapabilities ?? [];
    if (reqs.some((r) => !hasCapability(caps, r))) continue;
    items.push({
      href: `/${dept.slug}/${mod.route}`,
      label: mod.name,
      icon: mod.icon ?? "layout",
      group: "modules",
    });
  }
  return items;
}

export function getFirstNavHrefForDepartment(departmentSlug: string, session: PulseAuthSession | null): string | null {
  const items = buildDepartmentNavItems(departmentSlug, session);
  return items[0]?.href ?? null;
}

export function listDepartmentsAllowedForSession(session: PulseAuthSession | null): readonly Department[] {
  const allowed = session?.department_workspace_slugs;
  if (!allowed || allowed.length === 0) {
    return PLATFORM_DEPARTMENTS;
  }
  const set = new Set(allowed);
  return PLATFORM_DEPARTMENTS.filter((d) => set.has(d.slug));
}

/** First workspace home URL for the tenant rail “Workspaces” entry. */
export function defaultWorkspaceHubHref(session: PulseAuthSession | null): string {
  const depts = listDepartmentsAllowedForSession(session);
  const first = depts[0];
  if (!first) return "/overview";
  const mod = getDefaultModuleRouteForDepartment(first.slug, session);
  if (mod) return `/${first.slug}/${mod}`;
  return `/${first.slug}`;
}

export function listDepartmentsForSwitcher(): readonly Department[] {
  return PLATFORM_DEPARTMENTS;
}

/** Single legacy-rail entry so users can discover department workspaces without breaking existing nav. */
export const LEGACY_SIDEBAR_DEPARTMENT_HUB: PlatformNavItem = {
  href: "/maintenance",
  label: "Workspaces",
  icon: "layout",
  group: "platform",
};
