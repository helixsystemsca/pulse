/**
 * Platform department routes — navigation helpers (unified sidebar; no separate department app list).
 */
import { getDepartmentBySlug, PLATFORM_DEPARTMENTS } from "@/config/platform/departments";
import type { Department, PlatformNavItem } from "@/config/platform/types";
import { MASTER_FEATURES } from "@/config/platform/master-feature-registry";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { getDepartmentAccessibleFeatures, readAccessSnapshot } from "@/lib/access-snapshot";
import type { PlatformIconKey } from "@/config/platform/types";

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

/** Department workspace modules from canonical snapshot (membership + department features). */
export function buildDepartmentNavItems(departmentSlug: string, session: PulseAuthSession | null): PlatformNavItem[] {
  const dept = getDepartmentBySlug(departmentSlug);
  if (!dept || !session) return [];
  const snap = readAccessSnapshot(session);
  const allowed = new Set(getDepartmentAccessibleFeatures(departmentSlug, snap));
  const sorted = [...MASTER_FEATURES]
    .filter((f) => f.navVisible && f.platformDepartmentSlug === departmentSlug && allowed.has(f.feature))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.map((f) => ({
    href: f.route,
    label: f.label,
    icon: f.icon as PlatformIconKey,
    group: "modules" as const,
  }));
}

export function getFirstNavHrefForDepartment(departmentSlug: string, session: PulseAuthSession | null): string | null {
  const items = buildDepartmentNavItems(departmentSlug, session);
  return items[0]?.href ?? null;
}

export function listDepartmentsAllowedForSession(session: PulseAuthSession | null): readonly Department[] {
  return PLATFORM_DEPARTMENTS.filter((d) => buildDepartmentNavItems(d.slug, session).length > 0);
}

export function listDepartmentsForSwitcher(): readonly Department[] {
  return PLATFORM_DEPARTMENTS;
}
