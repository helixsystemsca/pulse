/**
 * Canonical permission metadata for UI (Team Management, tooltips, audits).
 * Keep keys aligned with `backend/app/core/rbac/catalog.py` and `catalog_sync` (DB seed at runtime).
 */
export type RbacPermissionMeta = {
  key: string;
  label: string;
  description: string;
  module: string;
  category: string;
};

export const RBAC_PERMISSION_CATALOG: readonly RbacPermissionMeta[] = [
  {
    key: "dashboard.view",
    label: "View leadership dashboard",
    description: "Open the tenant leadership / operations overview (/overview).",
    module: "dashboard",
    category: "Reporting",
  },
  { key: "work_requests.view", label: "View work requests", description: "Open work requests hub and lists.", module: "work_requests", category: "Operations" },
  { key: "work_requests.edit", label: "Edit work requests", description: "Create and update work requests.", module: "work_requests", category: "Operations" },
  { key: "compliance.view", label: "View inspections", description: "Inspections, logs, and compliance tools.", module: "compliance", category: "Operations" },
  { key: "compliance.manage", label: "Manage compliance", description: "Review, resend, flag, and update compliance records.", module: "compliance", category: "Operations" },
  { key: "inventory.view", label: "View inventory", description: "Browse inventory catalog.", module: "inventory", category: "Operations" },
  { key: "inventory.manage", label: "Manage inventory", description: "Adjust stock and inventory configuration.", module: "inventory", category: "Operations" },
  { key: "equipment.view", label: "View equipment", description: "Equipment registry and tool tracking.", module: "equipment", category: "Operations" },
  { key: "equipment.manage", label: "Manage equipment", description: "Create, update, and delete equipment and parts.", module: "equipment", category: "Operations" },
  { key: "procedures.view", label: "View procedures", description: "Standards, procedures, acknowledgments.", module: "procedures", category: "People & Quality" },
  { key: "team_insights.view", label: "View team insights", description: "Analytics and team insights.", module: "team_insights", category: "People & Quality" },
  { key: "team_management.view", label: "Team management", description: "Workers, roles, and HR roster tools.", module: "team_management", category: "People & Quality" },
  { key: "messaging.view", label: "View messaging", description: "Internal messaging and notifications hub.", module: "messaging", category: "Communications" },
  { key: "schedule.view", label: "View schedule", description: "Scheduling and classes.", module: "schedule", category: "Operations" },
  { key: "monitoring.view", label: "View monitoring", description: "Live operations and monitoring views.", module: "monitoring", category: "Operations" },
  { key: "projects.view", label: "View projects", description: "Projects and PM workspaces.", module: "projects", category: "Operations" },
  { key: "drawings.view", label: "View drawings", description: "Drawings and document hub.", module: "drawings", category: "Operations" },
  { key: "zones_devices.view", label: "View zones & devices", description: "Zones, devices, and floorplans.", module: "zones_devices", category: "Operations" },
  { key: "live_map.view", label: "View live map", description: "Live map and positioning.", module: "live_map", category: "Operations" },
  { key: "arena_advertising.view", label: "Arena advertising", description: "Arena advertising mapper.", module: "comms_advertising_mapper", category: "Communications" },
  { key: "social_planner.view", label: "Social planner", description: "Campaign and social content planner.", module: "comms_campaign_planner", category: "Communications" },
  { key: "publication_pipeline.view", label: "Publication pipeline", description: "Publication builder pipeline.", module: "comms_publication_builder", category: "Communications" },
  { key: "xplor_indesign.view", label: "Xplor → InDesign", description: "Xplor export to InDesign.", module: "comms_indesign_pipeline", category: "Communications" },
  { key: "communications_assets.view", label: "Communications assets", description: "Communications asset library.", module: "comms_assets", category: "Communications" },
] as const;

const byKey: ReadonlyMap<string, RbacPermissionMeta> = new Map(RBAC_PERMISSION_CATALOG.map((m) => [m.key, m]));

export function rbacPermissionMeta(key: string): RbacPermissionMeta | undefined {
  return byKey.get(key);
}
