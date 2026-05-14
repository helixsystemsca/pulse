/**
 * Platform department routes (`/{slug}/{module}`) — navigation helpers.
 * Each module row in the main tenant sidebar uses the same contract + RBAC rules as these helpers.
 */
import { getDepartmentBySlug, PLATFORM_DEPARTMENTS } from "@/config/platform/departments";
import type { Department, PlatformNavItem } from "@/config/platform/types";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { PLATFORM_WORKSPACE_MODULES } from "@/lib/rbac/platform-workspace-modules";
import { hasRbacPermission } from "@/lib/rbac/session-access";

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

function contractSet(session: PulseAuthSession | null): Set<string> {
  const raw = session?.contract_features?.length
    ? session.contract_features
    : session?.contract_enabled_features ?? [];
  return new Set(raw);
}

/** In-department module list (same gating as merged tenant sidebar links). */
export function buildDepartmentNavItems(departmentSlug: string, session: PulseAuthSession | null): PlatformNavItem[] {
  const dept = getDepartmentBySlug(departmentSlug);
  if (!dept) return [];
  const contract = contractSet(session);
  const items: PlatformNavItem[] = [];

  for (const mod of PLATFORM_WORKSPACE_MODULES) {
    if (!mod.departmentSlugs.includes(dept.slug)) continue;
    if (!contract.has(mod.requiredCompanyModule)) continue;
    if (!hasRbacPermission(session, mod.requiredRbacPermission)) continue;
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

/** Departments where the user has at least one visible scoped module (for in-app switchers). */
export function listDepartmentsAllowedForSession(session: PulseAuthSession | null): readonly Department[] {
  return PLATFORM_DEPARTMENTS.filter((d) => buildDepartmentNavItems(d.slug, session).length > 0);
}

export function listDepartmentsForSwitcher(): readonly Department[] {
  return PLATFORM_DEPARTMENTS;
}
