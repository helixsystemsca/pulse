import type { Department } from "@/config/platform/types";

/**
 * Seed departments for a single-tenant, multi-department municipal deployment.
 * Add rows here to introduce new departments — UI reads from this registry.
 */
export const PLATFORM_DEPARTMENTS: readonly Department[] = [
  {
    id: "dept_maintenance",
    slug: "maintenance",
    name: "Maintenance",
    icon: "wrench",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: [
      "mod_work_orders",
      "mod_inspections",
      "mod_equipment",
      "mod_procedures",
      "mod_analytics",
      "mod_messaging",
    ],
  },
  {
    id: "dept_communications",
    slug: "communications",
    name: "Communications",
    icon: "megaphone",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: [
      "mod_publication_builder",
      "mod_assets",
      "mod_procedures",
      "mod_analytics",
      "mod_messaging",
    ],
  },
  {
    id: "dept_aquatics",
    slug: "aquatics",
    name: "Aquatics",
    icon: "waves",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: ["mod_scheduling", "mod_procedures", "mod_analytics", "mod_messaging"],
  },
  {
    id: "dept_fitness",
    slug: "fitness",
    name: "Fitness",
    icon: "dumbbell",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: ["mod_classes", "mod_procedures", "mod_analytics", "mod_messaging"],
  },
  {
    id: "dept_administration",
    slug: "admin",
    name: "Administration",
    icon: "building",
    accentColor: "var(--ds-accent)",
    enabledModuleIds: ["mod_analytics", "mod_procedures", "mod_messaging"],
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
