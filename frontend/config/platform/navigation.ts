/**
 * Platform department routes — navigation helpers (unified sidebar; no separate department app list).
 */
import { getDepartmentBySlug, PLATFORM_DEPARTMENTS } from "@/config/platform/departments";
import type { Department, PlatformNavItem } from "@/config/platform/types";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { tenantSidebarNavItemsForSession } from "@/lib/rbac/tenant-nav";
import type { PlatformIconKey } from "@/config/platform/types";

const STORAGE_LAST_DEPT = "pulse_platform_department_slug_v1";

const PLATFORM_ICON_KEYS: readonly PlatformIconKey[] = [
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

function isPlatformIcon(icon: string): icon is PlatformIconKey {
  return PLATFORM_ICON_KEYS.includes(icon as PlatformIconKey);
}

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

/** Same entries as the unified tenant sidebar (no duplicate department rail). */
export function buildDepartmentNavItems(departmentSlug: string, session: PulseAuthSession | null): PlatformNavItem[] {
  const dept = getDepartmentBySlug(departmentSlug);
  if (!dept) return [];
  return tenantSidebarNavItemsForSession(session)
    .filter((row) => isPlatformIcon(row.icon))
    .map((row) => ({
      href: row.href,
      label: row.label,
      icon: row.icon as PlatformIconKey,
      group: "modules",
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
