/**
 * Tenant contract / Team Management module keys (must match `GLOBAL_SYSTEM_FEATURES` in backend
 * `system_catalog.py`). Used for role_feature_access and system-admin company feature toggles.
 *
 * {@link PRODUCT_MODULE_PERMISSION_SECTIONS} groups keys for the Team Management permissions card.
 */
export const PRODUCT_MODULE_PERMISSION_SECTIONS: readonly {
  id: string;
  label: string;
  description?: string;
  keys: readonly string[];
}[] = [
  {
    id: "tenant_dashboard",
    label: "Leadership dashboard",
    description:
      "Main operations / leadership overview (/overview). Turn off for tenants that only need workspaces (for example Communications).",
    keys: ["dashboard"],
  },
  {
    id: "department_workspaces",
    label: "Department workspaces",
    description:
      "Which department hubs appear in Workspaces (sidebar). Turning a hub off hides that workspace for this role; classic product pages (Work Requests, Inventory, etc.) still follow the sections below.",
    keys: [
      "workspace_maintenance",
      "workspace_communications",
      "workspace_reception",
      "workspace_aquatics",
      "workspace_fitness",
      "workspace_racquets",
      "workspace_admin",
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance & operations",
    description: "Work requests, inspections, inventory, equipment, monitoring, and projects.",
    keys: ["work_requests", "compliance", "inventory", "equipment", "monitoring", "projects"],
  },
  {
    id: "communications",
    label: "Communications",
    description: "Department workspace tools for marketing and publications (also gated by capabilities).",
    keys: [
      "comms_assets",
      "comms_advertising_mapper",
      "comms_publication_builder",
      "comms_indesign_pipeline",
      "comms_campaign_planner",
    ],
  },
  {
    id: "programs_people",
    label: "Scheduling, people & standards",
    keys: ["schedule", "team_management", "team_insights", "procedures", "messaging"],
  },
  {
    id: "maps",
    label: "Maps, drawings & devices",
    keys: ["drawings", "zones_devices", "live_map"],
  },
];

/** Flat list in a stable order (section order, then key order within section). */
export const TENANT_PRODUCT_MODULES: readonly string[] = PRODUCT_MODULE_PERMISSION_SECTIONS.flatMap((s) => [...s.keys]);

export const MODULE_LABEL: Record<string, string> = {
  dashboard: "Leadership dashboard",
  compliance: "Inspections & Logs",
  schedule: "Schedule",
  monitoring: "Monitoring",
  projects: "Projects",
  work_requests: "Work Requests",
  procedures: "Procedures",
  team_insights: "Team Insights",
  team_management: "Team Management",
  messaging: "Messaging",
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
