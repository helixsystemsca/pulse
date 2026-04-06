/**
 * Labels and ordering for `GLOBAL_SYSTEM_FEATURES` (backend `system_catalog.py`).
 * Keep keys in sync with tenant sidebar gating in `pulse-nav-features.ts`.
 */
export const SYSTEM_ADMIN_FEATURE_ORDER = [
  "compliance",
  "schedule",
  "monitoring",
  "projects",
  "work_orders",
  "workers",
  "inventory",
  "equipment",
  "floor_plan",
] as const;

export const SYSTEM_ADMIN_FEATURE_LABELS: Record<string, string> = {
  compliance: "Inspections & logs",
  schedule: "Schedule",
  monitoring: "Monitoring",
  projects: "Projects",
  work_orders: "Maintenance",
  workers: "Workers & roles",
  inventory: "Inventory",
  equipment: "Equipment & tracking",
  floor_plan: "Floor plans",
};

export function systemAdminFeatureLabel(key: string): string {
  return SYSTEM_ADMIN_FEATURE_LABELS[key] ?? key;
}

export function sortFeatureUsageKeys(keys: string[]): string[] {
  const order = new Map<string, number>(SYSTEM_ADMIN_FEATURE_ORDER.map((k, i) => [k, i]));
  return [...keys].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

/** Sort catalog keys from `/api/system/features/catalog` for consistent checkbox order. */
export function sortCatalogFeatures(catalog: string[]): string[] {
  const order = new Map<string, number>(SYSTEM_ADMIN_FEATURE_ORDER.map((k, i) => [k, i]));
  return [...catalog].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}
