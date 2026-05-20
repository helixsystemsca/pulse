/**
 * Sidebar section grouping — presentation metadata only.
 *
 * Input must already be permission-filtered (e.g. from `tenantSidebarNavItemsForLiveApp`).
 * This module performs NO access checks and must never be imported by route guards or resolvers.
 */
import { categorySortIndex, normalizeModuleCategory } from "@/config/platform/module-categories";
import type { TenantSidebarNavItem } from "@/lib/rbac/tenant-nav";

export type TenantSidebarNavGroup = {
  /** Display label for the section header (from registry `moduleCategory`). */
  category: string;
  items: TenantSidebarNavItem[];
};

/**
 * Groups authorized sidebar rows by `moduleCategory`.
 * Preserves item order within each category (caller should pass pre-sorted items).
 */
export function groupModulesByCategory(modules: readonly TenantSidebarNavItem[]): TenantSidebarNavGroup[] {
  if (!modules.length) return [];

  const buckets = new Map<string, TenantSidebarNavItem[]>();
  for (const row of modules) {
    const category = normalizeModuleCategory(row.moduleCategory);
    const list = buckets.get(category);
    if (list) list.push(row);
    else buckets.set(category, [row]);
  }

  const sortedCategories = [...buckets.keys()].sort((a, b) => {
    const diff = categorySortIndex(a) - categorySortIndex(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  return sortedCategories.map((category) => ({
    category,
    items: buckets.get(category) ?? [],
  }));
}

/** Flatten grouped sections (debug tools, tests). */
export function flattenSidebarNavGroups(groups: readonly TenantSidebarNavGroup[]): TenantSidebarNavItem[] {
  return groups.flatMap((g) => g.items);
}
