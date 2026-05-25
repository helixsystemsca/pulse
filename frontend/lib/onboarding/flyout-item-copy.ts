/** Short tour blurbs for sidebar flyout modules (feature registry keys). */
const FLYOUT_ITEM_DESCRIPTIONS: Partial<Record<string, string>> = {
  dashboard: "Leadership-wide KPIs, important dates, and organization-level widgets.",
  dashboard_worker: "Your operations-focused dashboard with the same widget canvas.",
  dashboard_project: "Project-scoped dashboard for delivery leads and PMs.",
  monitoring: "Live CO₂ tanks, pool chemistry, and system health in one view.",
  logs_inspections: "Inspection checklists, compliance logs, and audit history.",
  work_requests: "Submit, assign, and track maintenance work from request to done.",
  schedule: "Weekly staffing grid—build shifts, resolve conflicts, and publish.",
  schedule_availability: "Collect and review staff availability before you build the schedule.",
  schedule_coverage: "Coverage heatmaps to spot gaps across zones and roles.",
  schedule_shift_definitions: "Standard shift templates and codes used on the grid.",
  projects: "Operational projects, tasks, and workforce skill matching.",
  project_management: "PM timelines, dependencies, and cross-project delivery.",
  standards_routines: "Routine templates, daily assignments, and shift handoffs.",
  messaging: "Operational inbox and administrator product feedback.",
  training_overview: "Training KPIs—certifications, expirations, and compliance risk.",
  training_learning: "Procedures, acknowledgments, and learning assignments.",
  training_compliance: "Qualification matrix, gaps, and expiring credentials.",
  inventory: "Stock levels, locations, and low-inventory reorder signals.",
  equipment: "Asset registry, maintenance history, and assignments.",
  zones_devices: "Zones, devices, and how they tie into maps and monitoring.",
  drawings: "Spatial editor for facility maps and operational layers.",
  live_map: "Real-time presence and activity across the facility.",
  workforce_hub: "Hiring, development, recognition, and planning entry points.",
  workforce_insights: "Team analytics and operational insights for supervisors.",
  workforce_hiring: "Open roles, applicants, and hiring pipeline.",
  workforce_development: "Growth plans, skills, and development tracking.",
  workforce_onboarding: "New-hire checklists and onboarding progress.",
  workforce_recognition: "Peer recognition and team morale programs.",
  workforce_planning: "Long-range staffing and capacity planning.",
  workforce_coordination: "Cross-team coordination and handoffs.",
  permissions: "Roles, feature access, and who can open each module.",
  settings: "Organization settings, integrations, and preferences.",
  comms_campaign_planner: "Plan and schedule social and campaign content.",
  advertising_mapper: "Arena advertising zones and placement mapping.",
  xplor_indesign: "Xplor → InDesign publication pipeline.",
  comms_assets: "Shared media library for communications teams.",
};

export function flyoutItemTourDescription(featureKey: string, label: string): string {
  const custom = FLYOUT_ITEM_DESCRIPTIONS[featureKey];
  if (custom) return custom;
  return `Open ${label} for day-to-day work in this area of Panorama.`;
}
