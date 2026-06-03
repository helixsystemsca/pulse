/**
 * Team Management → Permissions: department × role-slot matrix (stored as
 * `department_role_feature_access` on workers settings).
 */

import { expandContractKeysForMatrixFilter, toCanonicalFeatureKey } from "@/lib/features/canonical-features";

export const PERMISSION_MATRIX_DEPARTMENTS = [
  "maintenance",
  "communications",
  "aquatics",
  "reception",
  "fitness",
  "racquets",
  "admin",
] as const;

export type PermissionMatrixDepartment = (typeof PERMISSION_MATRIX_DEPARTMENTS)[number];

export const PERMISSION_MATRIX_DEPARTMENT_LABEL: Record<PermissionMatrixDepartment, string> = {
  maintenance: "Maintenance",
  communications: "Communications",
  aquatics: "Aquatics",
  reception: "Reception",
  fitness: "Fitness",
  racquets: "Racquets",
  admin: "Administration",
};

/** Department → baseline frontline slot (organizational model). */
export const DEPARTMENT_BASELINE_SLOTS: Record<PermissionMatrixDepartment, PermissionMatrixRoleSlot> = {
  maintenance: "operations",
  communications: "coordination",
  reception: "coordination",
  aquatics: "aquatics_staff",
  fitness: "fitness_staff",
  racquets: "racquets_staff",
  admin: "admin_staff",
};

/** Stable keys stored under each department in `department_role_feature_access`. */
export const PERMISSION_MATRIX_ROLE_SLOTS = [
  "manager",
  "coordination",
  "supervisor",
  "lead",
  "operations",
  "aquatics_staff",
  "fitness_staff",
  "racquets_staff",
  "admin_staff",
  "team_member",
] as const;

export type PermissionMatrixRoleSlot = (typeof PERMISSION_MATRIX_ROLE_SLOTS)[number];

/** Operational labels shown in roster / admin UI (not internal matrix keys). */
export const PERMISSION_MATRIX_ROLE_LABEL: Record<PermissionMatrixRoleSlot, string> = {
  manager: "Manager",
  coordination: "Coordination",
  supervisor: "Supervisor",
  lead: "Lead",
  operations: "Operations",
  aquatics_staff: "Aquatics Staff",
  fitness_staff: "Fitness Staff",
  racquets_staff: "Racquets Staff",
  admin_staff: "Admin Staff",
  team_member: "Staff",
};

export const UNRESOLVED_MATRIX_SLOT = "unresolved";

/** Maps matrix slot → legacy `role_feature_access` bucket (for sync + delegated edits). */
export function legacyRoleBucketForSlot(slot: PermissionMatrixRoleSlot): "manager" | "supervisor" | "lead" | "worker" {
  if (slot === "manager") return "manager";
  if (slot === "supervisor") return "supervisor";
  if (slot === "lead") return "lead";
  return "worker";
}

const WORKER_TIER_SLOTS: readonly PermissionMatrixRoleSlot[] = [
  "coordination",
  "operations",
  "aquatics_staff",
  "fitness_staff",
  "racquets_staff",
  "admin_staff",
  "team_member",
];

export type PermissionFeatureGroup = { id: string; label: string; description?: string; keys: readonly string[] };

/** Keys mirrored across departments — master Team Management matrix lists every module once. */
const MAINTENANCE_OPS_KEYS = [
  "work_requests",
  "logs_inspections",
  "inventory",
  "inventory_scanner",
  "equipment",
  "monitoring",
  "projects",
] as const;

const COMMS_TOOLS_KEYS = [
  "comms_assets",
  "comms_advertising_mapper",
  "comms_indesign_pipeline",
  "comms_campaign_planner",
] as const;

const LEADERSHIP_KEYS = ["dashboard"] as const;

/** Per-surface dashboard toggles (Team Management matrix; contract module remains `dashboard`). */
const DASHBOARD_ACCESS_KEYS = [
  "dashboard_operations",
  "dashboard_leadership",
  "dashboard_project",
  "dashboard_inspections",
  "dashboard_team_insights",
  "dashboard_dept_communications",
  "dashboard_dept_aquatics",
  "dashboard_dept_reception",
  "dashboard_dept_fitness",
  "dashboard_dept_racquets",
  "dashboard_dept_admin",
] as const;

const PLANNING_SCHEDULE_KEYS = [
  "schedule",
  "schedule_availability",
  "schedule_coverage",
  "schedule_shift_definitions",
] as const;

const PLANNING_PROJECT_KEYS = ["projects", "project_management", "pm_workspace", "pm_planning"] as const;

const STANDARDS_PROGRAM_KEYS = [
  "procedures",
  "standards_training",
  "standards_certifications",
  "standards_compliance",
  "standards_my_procedures",
  "standards_routines",
  "standards_acknowledgments",
] as const;

const SHARED_PROGRAM_KEYS = ["team_management", "team_insights", "messaging"] as const;

const MAP_KEYS = [
  "drawings",
  "facilities_spatial",
  "spatial_infrastructure",
  "zones_devices",
  "live_map",
] as const;

/** Single catalog for company admins — underlying rows are duplicated per workspace department on save. */
export const MASTER_PERMISSION_FEATURE_GROUPS: PermissionFeatureGroup[] = [
  {
    id: "dashboard",
    label: "Leadership dashboard",
    description: "Main operations / leadership overview (/overview).",
    keys: [...LEADERSHIP_KEYS],
  },
  {
    id: "dashboard_access",
    label: "Dashboard surfaces",
    description: "Which dashboard routes appear in the Dashboards flyout.",
    keys: [...DASHBOARD_ACCESS_KEYS],
  },
  {
    id: "ops",
    label: "Maintenance & operations",
    description: "Work requests, inspections & logs, inventory, equipment, monitoring, and projects.",
    keys: ["work_requests", "logs_inspections", "inventory", "inventory_scanner", "equipment", "monitoring", "projects"],
  },
  {
    id: "comms",
    label: "Communications tools",
    description: "Campaigns, assets, advertising mapper, and Xplor → InDesign export.",
    keys: [...COMMS_TOOLS_KEYS],
  },
  {
    id: "planning_schedule",
    label: "Planning · Scheduling",
    description:
      "Workforce schedule. Availability and coverage are opened from the Schedule page; shift definitions are under Schedule settings.",
    keys: [...PLANNING_SCHEDULE_KEYS],
  },
  {
    id: "planning_projects",
    label: "Planning · Projects",
    description: "Project list and Project Management (workspace + planning). Legacy pm_workspace / pm_planning keys still apply.",
    keys: [...PLANNING_PROJECT_KEYS],
  },
  {
    id: "standards",
    label: "Training (sidebar)",
    description:
      "Routes under the Training domain: overview, learning, workforce compliance matrix, certifications, procedures, and routines.",
    keys: [...STANDARDS_PROGRAM_KEYS],
  },
  {
    id: "shared",
    label: "People & messaging",
    keys: [...SHARED_PROGRAM_KEYS],
  },
  {
    id: "maps",
    label: "Maps, drawings & devices",
    keys: [...MAP_KEYS],
  },
];

/** Feature toggles shown for the selected department (subset of contract). */
export function permissionFeatureGroupsForDepartment(dept: PermissionMatrixDepartment): PermissionFeatureGroup[] {
  const maintenanceOps = MAINTENANCE_OPS_KEYS;
  const commsTools = COMMS_TOOLS_KEYS;
  const leadership = LEADERSHIP_KEYS;
  const sharedProgram = [
    ...PLANNING_SCHEDULE_KEYS,
    ...PLANNING_PROJECT_KEYS,
    ...STANDARDS_PROGRAM_KEYS,
    ...SHARED_PROGRAM_KEYS,
  ];
  const maps = MAP_KEYS;

  if (dept === "maintenance") {
    return [
      {
        id: "dashboard",
        label: "Leadership dashboard",
        description: "Main operations / leadership overview (/overview).",
        keys: [...leadership],
      },
      {
        id: "dashboard_access",
        label: "Dashboard surfaces",
        description: "Operations, leadership, project, and department dashboards.",
        keys: [...DASHBOARD_ACCESS_KEYS],
      },
      { id: "ops", label: "Maintenance & operations", description: "Classic Helix modules for this department.", keys: [...maintenanceOps] },
      {
        id: "planning_schedule",
        label: "Planning · Scheduling",
        keys: [...PLANNING_SCHEDULE_KEYS],
      },
      { id: "planning_projects", label: "Planning · Projects", keys: [...PLANNING_PROJECT_KEYS] },
      { id: "standards", label: "Training (sidebar)", keys: [...STANDARDS_PROGRAM_KEYS] },
      { id: "shared", label: "People & messaging", keys: [...SHARED_PROGRAM_KEYS] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "communications") {
    return [
      {
        id: "dashboard",
        label: "Leadership dashboard",
        description: "Main operations / leadership overview (/overview).",
        keys: [...leadership],
      },
      {
        id: "dashboard_access",
        label: "Dashboard surfaces",
        description: "Department blank dashboard and shared leadership views.",
        keys: ["dashboard_dept_communications", "dashboard_leadership", "dashboard_operations", "dashboard_project"],
      },
      { id: "comms", label: "Communications tools", description: "Publication, campaigns, assets, and related tools.", keys: [...commsTools] },
      {
        id: "planning_schedule",
        label: "Planning · Scheduling",
        keys: [...PLANNING_SCHEDULE_KEYS],
      },
      { id: "planning_projects", label: "Planning · Projects", keys: [...PLANNING_PROJECT_KEYS] },
      { id: "standards", label: "Standards", keys: [...STANDARDS_PROGRAM_KEYS] },
      { id: "shared", label: "People & messaging", keys: [...SHARED_PROGRAM_KEYS] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "aquatics") {
    return [
      {
        id: "dashboard",
        label: "Leadership dashboard",
        description: "Main operations / leadership overview (/overview).",
        keys: [...leadership],
      },
      {
        id: "dashboard_access",
        label: "Dashboard surfaces",
        keys: ["dashboard_dept_aquatics", "dashboard_leadership", "dashboard_operations"],
      },
      {
        id: "planning_schedule",
        label: "Planning · Scheduling",
        keys: [...PLANNING_SCHEDULE_KEYS],
      },
      { id: "shared", label: "People & standards", keys: ["team_management", "team_insights", "procedures", "messaging"] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "reception") {
    return [
      {
        id: "dashboard",
        label: "Leadership dashboard",
        keys: [...leadership],
      },
      {
        id: "dashboard_access",
        label: "Dashboard surfaces",
        keys: ["dashboard_dept_reception", "dashboard_leadership", "dashboard_operations"],
      },
      { id: "comms", label: "Communications tools", keys: [...commsTools] },
      {
        id: "planning_schedule",
        label: "Planning · Scheduling",
        keys: [...PLANNING_SCHEDULE_KEYS],
      },
      { id: "planning_projects", label: "Planning · Projects", keys: [...PLANNING_PROJECT_KEYS] },
      { id: "standards", label: "Standards", keys: [...STANDARDS_PROGRAM_KEYS] },
      { id: "shared", label: "People & messaging", keys: [...SHARED_PROGRAM_KEYS] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "fitness") {
    return [
      {
        id: "dashboard",
        label: "Leadership dashboard",
        keys: [...leadership],
      },
      {
        id: "dashboard_access",
        label: "Dashboard surfaces",
        keys: ["dashboard_dept_fitness", "dashboard_leadership", "dashboard_operations"],
      },
      {
        id: "planning_schedule",
        label: "Planning · Scheduling",
        keys: [...PLANNING_SCHEDULE_KEYS],
      },
      { id: "shared", label: "People & standards", keys: ["team_management", "team_insights", "procedures", "messaging"] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "racquets") {
    return [
      {
        id: "dashboard",
        label: "Leadership dashboard",
        keys: [...leadership],
      },
      {
        id: "dashboard_access",
        label: "Dashboard surfaces",
        keys: ["dashboard_dept_racquets", "dashboard_leadership", "dashboard_operations"],
      },
      {
        id: "planning_schedule",
        label: "Planning · Scheduling",
        keys: [...PLANNING_SCHEDULE_KEYS],
      },
      { id: "shared", label: "People & standards", keys: ["team_management", "team_insights", "procedures", "messaging"] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "admin") {
    return [
      {
        id: "dashboard",
        label: "Leadership dashboard",
        keys: [...leadership],
      },
      {
        id: "dashboard_access",
        label: "Dashboard surfaces",
        keys: ["dashboard_dept_admin", "dashboard_leadership", "dashboard_operations", "dashboard_project"],
      },
      {
        id: "planning_schedule",
        label: "Planning · Scheduling",
        keys: [...PLANNING_SCHEDULE_KEYS],
      },
      { id: "planning_projects", label: "Planning · Projects", keys: [...PLANNING_PROJECT_KEYS] },
      { id: "standards", label: "Standards", keys: [...STANDARDS_PROGRAM_KEYS] },
      { id: "shared", label: "People & messaging", keys: [...SHARED_PROGRAM_KEYS] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  return [];
}

/** Build legacy `role_feature_access` rows as unions across departments (delegation + fallback). */
export function computeLegacyRoleFeatureAccessFromMatrix(
  matrix: Record<string, Record<string, string[]>>,
  contractCatalog: readonly string[],
): Record<string, string[]> {
  const cset = new Set(contractCatalog);
  const uniq = (xs: string[]) => [...new Set(xs)].filter((x) => cset.has(x)).sort();

  const collect = (slot: PermissionMatrixRoleSlot): string[] => {
    const acc = new Set<string>();
    for (const d of PERMISSION_MATRIX_DEPARTMENTS) {
      const row = matrix[d];
      if (!row) continue;
      const list = row[slot];
      if (Array.isArray(list)) list.forEach((x) => acc.add(x));
    }
    return uniq([...acc]);
  };

  const workerUnion = new Set<string>();
  for (const s of WORKER_TIER_SLOTS) {
    collect(s).forEach((x) => workerUnion.add(x));
  }

  return {
    manager: collect("manager"),
    supervisor: collect("supervisor"),
    lead: collect("lead"),
    worker: uniq([...workerUnion]),
  };
}

export function emptyDepartmentRoleMatrix(): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const d of PERMISSION_MATRIX_DEPARTMENTS) {
    out[d] = {};
    for (const s of PERMISSION_MATRIX_ROLE_SLOTS) {
      out[d][s] = [];
    }
  }
  return out;
}

export function seedDepartmentRoleMatrixFromLegacy(
  contractCatalog: readonly string[],
  legacy: Record<string, string[]>,
): Record<string, Record<string, string[]>> {
  const out = emptyDepartmentRoleMatrix();
  const cat = [...contractCatalog];
  const pick = (bucket: "manager" | "supervisor" | "lead" | "worker") => {
    const raw = legacy[bucket];
    if (raw?.length) return raw.filter((x) => cat.includes(x));
    return [...cat];
  };
  for (const d of PERMISSION_MATRIX_DEPARTMENTS) {
    const baseline = DEPARTMENT_BASELINE_SLOTS[d];
    for (const s of PERMISSION_MATRIX_ROLE_SLOTS) {
      if (s === baseline) {
        out[d][s] = [...pick("worker")];
      } else {
        out[d][s] = [...pick(legacyRoleBucketForSlot(s))];
      }
    }
  }
  return out;
}

export function hasPersistedDepartmentRoleMatrix(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return PERMISSION_MATRIX_DEPARTMENTS.some((d) => {
    const row = o[d];
    return row !== undefined && row !== null && typeof row === "object";
  });
}

export function normalizeDepartmentRoleMatrixFromApi(
  raw: unknown,
  contractCatalog: readonly string[],
  legacy: Record<string, string[]>,
): Record<string, Record<string, string[]>> {
  const seed = seedDepartmentRoleMatrixFromLegacy(contractCatalog, legacy);
  if (!hasPersistedDepartmentRoleMatrix(raw) || typeof raw !== "object" || raw === null) {
    return seed;
  }
  const obj = raw as Record<string, Record<string, unknown>>;
  // Contract rows often store parent `dashboard` only; matrix toggles use flyout keys
  // (dashboard_operations, dashboard_dept_*). Must match expandContractKeysForMatrixFilter.
  const cat = expandContractKeysForMatrixFilter(contractCatalog);
  for (const d of PERMISSION_MATRIX_DEPARTMENTS) {
    const row = obj[d];
    if (!row || typeof row !== "object") continue;
    const baseline = DEPARTMENT_BASELINE_SLOTS[d];
    for (const s of PERMISSION_MATRIX_ROLE_SLOTS) {
      const list = row[s];
      if (Array.isArray(list)) {
        seed[d]![s] = list
          .map((x) => {
            const raw = String(x).trim();
            const canonical = toCanonicalFeatureKey(raw);
            if (canonical === "logs_inspections") return "logs_inspections";
            return raw;
          })
          .filter((x) => cat.has(x) || cat.has(toCanonicalFeatureKey(x) ?? ""));
      }
    }
    if (baseline && !seed[d]![baseline]?.length && seed[d]!.team_member?.length) {
      seed[d]![baseline] = [...seed[d]!.team_member];
    }
  }
  return seed;
}

/** Toggle one module for exactly one `(department, role_slot)` cell — saves independently per department. */
export function toggleModuleForDepartmentMatrixSlot(
  prev: Record<string, Record<string, string[]>>,
  dept: PermissionMatrixDepartment,
  slot: PermissionMatrixRoleSlot,
  mod: string,
): Record<string, Record<string, string[]>> {
  const next: Record<string, Record<string, string[]>> = { ...prev };
  const row = { ...(next[dept] ?? {}) };
  const cur = new Set(row[slot] ?? []);
  if (cur.has(mod)) cur.delete(mod);
  else cur.add(mod);
  row[slot] = [...cur].sort();
  next[dept] = row;
  return next;
}
