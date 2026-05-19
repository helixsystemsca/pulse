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
    label: "View all dashboards (legacy)",
    description: "Grants every dashboard surface until roles are migrated to granular keys.",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.operations.view",
    label: "Operations dashboard",
    description: "Personal operations home (/worker).",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.leadership.view",
    label: "Leadership dashboard",
    description: "Organization leadership overview (/overview).",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.project.view",
    label: "Project dashboard",
    description: "Project portfolio overview (/overview/project).",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.inspections.view",
    label: "Inspections & logs dashboard",
    description: "Compliance dashboard flyout entry (/dashboard/compliance).",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.team_insights.view",
    label: "Team insights dashboard",
    description: "Maintenance team insights dashboard flyout entry.",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.kiosk.view",
    label: "Kiosk displays",
    description: "Fullscreen kiosk dashboard routes (/kiosk/*).",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.dept.communications.view",
    label: "Communications department dashboard",
    description: "Blank widget canvas for Communications (/dashboard/department/communications).",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.dept.aquatics.view",
    label: "Aquatics department dashboard",
    description: "Blank widget canvas for Aquatics.",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.dept.reception.view",
    label: "Reception department dashboard",
    description: "Blank widget canvas for Reception.",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.dept.fitness.view",
    label: "Fitness department dashboard",
    description: "Blank widget canvas for Fitness.",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.dept.racquets.view",
    label: "Racquets department dashboard",
    description: "Blank widget canvas for Racquets.",
    module: "dashboard",
    category: "Reporting",
  },
  {
    key: "dashboard.dept.admin.view",
    label: "Administration department dashboard",
    description: "Blank widget canvas for Administration.",
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
  { key: "procedures.view", label: "View procedures", description: "Standards procedures, SOP sign-offs, and quizzes.", module: "procedures", category: "People & Quality" },
  {
    key: "standards.training.view",
    label: "View standards training",
    description: "Workforce qualifications hub (all training sub-views).",
    module: "standards_training",
    category: "People & Quality",
  },
  {
    key: "standards.training.overview.view",
    label: "Training overview",
    description: "Workforce qualification overview dashboard and KPIs.",
    module: "standards_training",
    category: "People & Quality",
  },
  {
    key: "standards.training.workers.view",
    label: "Worker qualifications",
    description: "Per-worker certification and competency profiles.",
    module: "standards_training",
    category: "People & Quality",
  },
  {
    key: "standards.training.certifications.view",
    label: "Certification registry",
    description: "Canonical registry and holder coverage.",
    module: "standards_training",
    category: "People & Quality",
  },
  {
    key: "standards.training.compliance.view",
    label: "Compliance matrix",
    description: "Procedure training matrix and operational readiness.",
    module: "standards_training",
    category: "People & Quality",
  },
  {
    key: "standards.training.expiring.view",
    label: "Expiring qualifications",
    description: "Expiring, expired, and pending verification queues.",
    module: "standards_training",
    category: "People & Quality",
  },
  {
    key: "standards.certifications.view",
    label: "View certifications",
    description: "Canonical certification registry and employee credentials.",
    module: "standards_certifications",
    category: "People & Quality",
  },
  {
    key: "standards.certifications.manage",
    label: "Manage certifications",
    description: "Edit registry codes and verify employee certification proof.",
    module: "standards_certifications",
    category: "People & Quality",
  },
  {
    key: "standards.compliance.view",
    label: "View workforce compliance",
    description: "Training matrix, readiness %, and compliance oversight.",
    module: "standards_compliance",
    category: "People & Quality",
  },
  {
    key: "standards.compliance.manage",
    label: "Manage workforce compliance",
    description: "Matrix overrides, tier configuration, and compliance reports.",
    module: "standards_compliance",
    category: "People & Quality",
  },
  { key: "team_insights.view", label: "View team insights", description: "Analytics and team insights.", module: "team_insights", category: "People & Quality" },
  { key: "team_management.view", label: "Team management", description: "Workers, roles, and HR roster tools.", module: "team_management", category: "People & Quality" },
  { key: "messaging.view", label: "View messaging", description: "Internal messaging and notifications hub.", module: "messaging", category: "Communications" },
  { key: "schedule.view", label: "View schedule", description: "Scheduling and classes.", module: "schedule", category: "Operations" },
  {
    key: "scheduling.project_overlays.view",
    label: "Project schedule overlays",
    description: "Timeline project bars on the schedule calendar.",
    module: "schedule",
    category: "Operations",
  },
  {
    key: "scheduling.pto_conflict_visibility.view",
    label: "PTO project conflict hints",
    description: "Staffing warnings when PTO overlaps active projects.",
    module: "schedule",
    category: "Operations",
  },
  { key: "monitoring.view", label: "View monitoring", description: "Live operations and monitoring views.", module: "monitoring", category: "Operations" },
  { key: "projects.view", label: "View projects", description: "Project list and project dashboards.", module: "projects", category: "Operations" },
  {
    key: "projects.pm.view",
    label: "PM workspace & planning",
    description: "PM workspace, planning boards, and critical-path tools.",
    module: "projects",
    category: "Operations",
  },
  { key: "drawings.view", label: "View drawings", description: "Drawings and document hub.", module: "drawings", category: "Operations" },
  { key: "zones_devices.view", label: "View zones & devices", description: "Zones, devices, and floorplans.", module: "zones_devices", category: "Operations" },
  { key: "live_map.view", label: "View live map", description: "Live map and positioning.", module: "live_map", category: "Operations" },
  { key: "arena_advertising.view", label: "Arena advertising", description: "Arena advertising mapper.", module: "comms_advertising_mapper", category: "Communications" },
  { key: "social_planner.view", label: "Social planner", description: "Campaign and social content planner.", module: "comms_campaign_planner", category: "Communications" },
  { key: "xplor_indesign.view", label: "Xplor → InDesign", description: "Xplor export to InDesign.", module: "comms_indesign_pipeline", category: "Communications" },
  { key: "communications_assets.view", label: "Communications assets", description: "Communications asset library.", module: "comms_assets", category: "Communications" },
] as const;

const byKey: ReadonlyMap<string, RbacPermissionMeta> = new Map(RBAC_PERMISSION_CATALOG.map((m) => [m.key, m]));

export function rbacPermissionMeta(key: string): RbacPermissionMeta | undefined {
  return byKey.get(key);
}
