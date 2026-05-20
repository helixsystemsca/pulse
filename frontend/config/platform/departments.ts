import type { Department } from "@/config/platform/types";
import { moduleIdsForDepartmentSlug } from "@/config/platform/modules";

/**
 * Seed departments for a single-tenant, multi-department municipal deployment.
 * `enabledModuleIds` are derived from {@link PLATFORM_MODULES} so hub pages and the
 * workspace side rail stay aligned with the same registry as Team Management toggles.
 */
export const PLATFORM_DEPARTMENTS: readonly Department[] = [
  {
    id: "dept_maintenance",
    slug: "maintenance",
    name: "Maintenance",
    icon: "wrench",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: moduleIdsForDepartmentSlug("maintenance"),
  },
  {
    id: "dept_communications",
    slug: "communications",
    name: "Communications",
    icon: "megaphone",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: moduleIdsForDepartmentSlug("communications"),
  },
  {
    id: "dept_reception",
    slug: "reception",
    name: "Reception",
    icon: "layout",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: moduleIdsForDepartmentSlug("reception"),
  },
  {
    id: "dept_aquatics",
    slug: "aquatics",
    name: "Aquatics",
    icon: "waves",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: moduleIdsForDepartmentSlug("aquatics"),
  },
  {
    id: "dept_fitness",
    slug: "fitness",
    name: "Fitness",
    icon: "dumbbell",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: moduleIdsForDepartmentSlug("fitness"),
  },
  {
    id: "dept_racquets",
    slug: "racquets",
    name: "Racquets",
    icon: "scroll-text",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: moduleIdsForDepartmentSlug("racquets"),
  },
  {
    id: "dept_administration",
    slug: "admin",
    name: "Administration",
    icon: "building",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: moduleIdsForDepartmentSlug("admin"),
  },
] as const;

export const PLATFORM_DEPARTMENT_SLUGS = PLATFORM_DEPARTMENTS.map((d) => d.slug);

const bySlug = new Map(PLATFORM_DEPARTMENTS.map((d) => [d.slug, d]));

export function getDepartmentBySlug(slug: string): Department | undefined {
  return bySlug.get(slug);
}

export function isPlatformDepartmentSlug(slug: string): boolean {
  return bySlug.has(slug);
}
