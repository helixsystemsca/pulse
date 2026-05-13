/**
 * Labels and ordering for `GLOBAL_SYSTEM_FEATURES` (backend `system_catalog.py`).
 * Keep keys in sync with tenant sidebar gating in `pulse-nav-features.ts`.
 */
export const SYSTEM_ADMIN_FEATURE_ORDER = [
  "compliance",
  "schedule",
  "monitoring",
  "projects",
  "work_requests",
  "procedures",
  "team_insights",
  "team_management",
  "inventory",
  "equipment",
  "comms_assets",
  "comms_advertising_mapper",
  "comms_publication_builder",
  "comms_indesign_pipeline",
  "comms_campaign_planner",
  "drawings",
  "zones_devices",
  "live_map",
  "workspace_maintenance",
  "workspace_communications",
  "workspace_reception",
  "workspace_aquatics",
  "workspace_fitness",
  "workspace_racquets",
  "workspace_admin",
] as const;

export const SYSTEM_ADMIN_FEATURE_LABELS: Record<string, string> = {
  compliance: "Inspections & Logs",
  schedule: "Schedule",
  monitoring: "Monitoring",
  projects: "Projects",
  work_requests: "Work Requests",
  procedures: "Procedures",
  team_insights: "Team Insights",
  team_management: "Team Management",
  inventory: "Inventory",
  equipment: "Equipment",
  drawings: "Drawings",
  zones_devices: "Zones & Devices",
  live_map: "Live Map",
  comms_assets: "Communications · Assets",
  comms_advertising_mapper: "Communications · Advertising mapper",
  comms_publication_builder: "Communications · Publication pipeline",
  comms_indesign_pipeline: "Communications · RTF / TXT → InDesign",
  comms_campaign_planner: "Communications · Campaign planner",
  workspace_maintenance: "Workspace · Maintenance",
  workspace_communications: "Workspace · Communications",
  workspace_reception: "Workspace · Reception",
  workspace_aquatics: "Workspace · Aquatics",
  workspace_fitness: "Workspace · Fitness",
  workspace_racquets: "Workspace · Racquets",
  workspace_admin: "Workspace · Administration",
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
