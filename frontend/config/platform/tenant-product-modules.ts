/**
 * Team Management / role feature toggles — canonical keys aligned with backend `canonical_catalog.py`.
 */
import { CANONICAL_PRODUCT_FEATURES, type CanonicalFeatureKey } from "@/lib/features/canonical-features";

export const PRODUCT_MODULE_PERMISSION_SECTIONS: readonly {
  id: string;
  label: string;
  description?: string;
  keys: readonly CanonicalFeatureKey[];
}[] = [
  {
    id: "overview",
    label: "Leadership & monitoring",
    keys: ["dashboard", "monitoring", "team_insights"],
  },
  {
    id: "operations",
    label: "Maintenance & operations",
    description: "Work requests, inspections, inventory, equipment, and projects.",
    keys: ["work_requests", "logs_inspections", "inventory", "equipment", "projects"],
  },
  {
    id: "people",
    label: "People & scheduling",
    keys: ["schedule", "team_management", "standards", "procedures", "messaging"],
  },
  {
    id: "maps",
    label: "Maps, drawings & devices",
    keys: ["drawings", "zones_devices", "live_map"],
  },
  {
    id: "communications",
    label: "Communications",
    keys: [
      "advertising_mapper",
      "xplor_indesign",
      "comms_assets",
      "comms_publication_builder",
      "comms_campaign_planner",
    ],
  },
];

export const TENANT_PRODUCT_MODULES: readonly CanonicalFeatureKey[] =
  PRODUCT_MODULE_PERMISSION_SECTIONS.flatMap((s) => [...s.keys]);

export const MODULE_LABEL: Record<CanonicalFeatureKey, string> = {
  dashboard: "Dashboard",
  monitoring: "Monitoring",
  logs_inspections: "Inspections & Logs",
  inventory: "Inventory",
  standards: "Standards",
  team_management: "Team Management",
  team_insights: "Team Insights",
  equipment: "Equipment",
  live_map: "Live Map",
  zones_devices: "Zones & Devices",
  advertising_mapper: "Arena Advertising",
  xplor_indesign: "Xplor → InDesign",
  drawings: "Drawings",
  schedule: "Schedule",
  projects: "Projects",
  work_requests: "Work Requests",
  procedures: "Procedures",
  messaging: "Messaging",
  comms_assets: "Communications · Assets",
  comms_publication_builder: "Communications · Publication pipeline",
  comms_campaign_planner: "Communications · Campaign planner",
};

/** All canonical keys (for validation). */
export const ALL_CANONICAL_FEATURES = CANONICAL_PRODUCT_FEATURES;
