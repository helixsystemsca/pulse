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
    keys: [
      "schedule",
      "team_management",
      "standards",
      "procedures",
      "standards_training",
      "standards_certifications",
      "standards_compliance",
      "messaging",
    ],
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
      "comms_campaign_planner",
    ],
  },
];

export const TENANT_PRODUCT_MODULES: readonly CanonicalFeatureKey[] =
  PRODUCT_MODULE_PERMISSION_SECTIONS.flatMap((s) => [...s.keys]);

export const MODULE_LABEL: Record<CanonicalFeatureKey, string> = {
  dashboard: "Dashboard (legacy)",
  dashboard_operations: "Operations dashboard",
  dashboard_leadership: "Leadership dashboard",
  dashboard_project: "Project dashboard",
  dashboard_inspections: "Inspections & logs dashboard",
  dashboard_team_insights: "Team insights dashboard",
  dashboard_dept_communications: "Communications dashboard",
  dashboard_dept_aquatics: "Aquatics dashboard",
  dashboard_dept_reception: "Reception dashboard",
  dashboard_dept_fitness: "Fitness dashboard",
  dashboard_dept_racquets: "Racquets dashboard",
  dashboard_dept_admin: "Administration dashboard",
  monitoring: "Monitoring",
  logs_inspections: "Inspections & Logs",
  inventory: "Inventory",
  standards: "Standards",
  team_management: "Permissions",
  team_insights: "Team Insights",
  equipment: "Equipment",
  live_map: "Live Map",
  zones_devices: "Zones & Devices",
  advertising_mapper: "Arena Advertising",
  xplor_indesign: "Xplor → InDesign",
  drawings: "Drawings",
  schedule: "Schedule",
  schedule_availability: "Availability",
  schedule_coverage: "Coverage",
  schedule_shift_definitions: "Shift definitions",
  projects: "Projects",
  project_management: "Project Management",
  pm_workspace: "PM workspace (legacy)",
  pm_planning: "PM planning (legacy)",
  work_requests: "Work Requests",
  procedures: "Procedures",
  standards_training: "Training",
  standards_certifications: "Certifications",
  standards_compliance: "Compliance",
  standards_my_procedures: "My procedures",
  standards_routines: "Routines",
  standards_acknowledgments: "Acknowledgment archive",
  facilities_spatial: "Facilities (drawings)",
  spatial_infrastructure: "Infrastructure maps",
  messaging: "Messaging",
  comms_assets: "Communications · Assets",
  comms_campaign_planner: "Communications · Campaign planner",
};

/** All canonical keys (for validation). */
export const ALL_CANONICAL_FEATURES = CANONICAL_PRODUCT_FEATURES;
