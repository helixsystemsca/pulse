import { PLATFORM_DEPARTMENTS } from "@/config/platform/departments";
import type { PulseAuthSession } from "@/lib/pulse-session";

export const SCHEDULE_DEPARTMENT_STORAGE_KEY = "pulse_schedule_department_slug_v1";

const VALID_SLUGS = new Set(PLATFORM_DEPARTMENTS.map((d) => d.slug));

export function normalizeScheduleDepartmentSlug(raw: string | null | undefined): string | null {
  const slug = (raw ?? "").trim().toLowerCase();
  if (!slug || !VALID_SLUGS.has(slug)) return null;
  return slug;
}

/** Default schedule department from HR profile (e.g. communications for Lisa). */
export function defaultScheduleDepartmentFromSession(
  session: Pick<PulseAuthSession, "hr_department"> | null | undefined,
): string {
  return normalizeScheduleDepartmentSlug(session?.hr_department) ?? "maintenance";
}

export function readScheduleDepartmentPreference(
  session: Pick<PulseAuthSession, "hr_department"> | null | undefined,
): string {
  const fallback = defaultScheduleDepartmentFromSession(session);
  if (typeof window === "undefined") return fallback;
  try {
    const stored = normalizeScheduleDepartmentSlug(localStorage.getItem(SCHEDULE_DEPARTMENT_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeScheduleDepartmentPreference(slug: string): void {
  if (typeof window === "undefined") return;
  const norm = normalizeScheduleDepartmentSlug(slug);
  if (!norm) return;
  try {
    localStorage.setItem(SCHEDULE_DEPARTMENT_STORAGE_KEY, norm);
  } catch {
    /* ignore */
  }
}

export type ScheduleDepartmentOption = { slug: string; name: string };

/** Departments the user may view in the schedule dropdown. */
export function scheduleDepartmentOptionsForSession(
  session: Pick<PulseAuthSession, "hr_department"> | null | undefined,
  canViewAllDepartments: boolean,
): ScheduleDepartmentOption[] {
  if (canViewAllDepartments) {
    return PLATFORM_DEPARTMENTS.map((d) => ({ slug: d.slug, name: d.name }));
  }
  const slug = defaultScheduleDepartmentFromSession(session);
  const dept = PLATFORM_DEPARTMENTS.find((d) => d.slug === slug);
  return [{ slug, name: dept?.name ?? slug }];
}

export function scheduleDepartmentQueryParam(slug: string): string {
  return `department_slug=${encodeURIComponent(slug)}`;
}
