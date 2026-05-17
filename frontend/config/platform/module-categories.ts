/**
 * Sidebar presentation categories — UI organization only.
 *
 * NEVER use `moduleCategory` for RBAC, contracts, route guards, or feature visibility.
 * Authorization flows through the permission matrix only; grouping runs after access resolution.
 */

/** Default bucket when registry omits `moduleCategory`. */
export const DEFAULT_MODULE_CATEGORY = "General" as const;

export type ModuleCategory =
  | typeof DEFAULT_MODULE_CATEGORY
  | "Communications"
  | "Operations"
  | "Maintenance"
  | "Administration"
  | (string & {});

/** Preferred section order in the tenant sidebar (unknown categories sort after these, A–Z). */
export const MODULE_CATEGORY_ORDER: readonly string[] = [
  DEFAULT_MODULE_CATEGORY,
  "Communications",
  "Operations",
  "Maintenance",
  "Administration",
];

export function normalizeModuleCategory(raw?: string | null): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return DEFAULT_MODULE_CATEGORY;
  return trimmed;
}

export function categorySortIndex(category: string): number {
  const idx = MODULE_CATEGORY_ORDER.indexOf(category);
  if (idx >= 0) return idx;
  return MODULE_CATEGORY_ORDER.length;
}
