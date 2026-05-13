/**
 * Team Management → Permissions: department × role-slot matrix (stored as
 * `department_role_feature_access` on workers settings).
 */

export const PERMISSION_MATRIX_DEPARTMENTS = [
  "maintenance",
  "communications",
  "aquatics",
  "reception",
  "fitness",
  "racquets",
] as const;

export type PermissionMatrixDepartment = (typeof PERMISSION_MATRIX_DEPARTMENTS)[number];

export const PERMISSION_MATRIX_DEPARTMENT_LABEL: Record<PermissionMatrixDepartment, string> = {
  maintenance: "Maintenance",
  communications: "Communications",
  aquatics: "Aquatics",
  reception: "Reception",
  fitness: "Fitness",
  racquets: "Racquets",
};

/** Stable keys stored under each department in `department_role_feature_access`. */
export const PERMISSION_MATRIX_ROLE_SLOTS = [
  "manager",
  "coordination",
  "supervisor",
  "lead",
  "operations",
  "team_member",
] as const;

export type PermissionMatrixRoleSlot = (typeof PERMISSION_MATRIX_ROLE_SLOTS)[number];

export const PERMISSION_MATRIX_ROLE_LABEL: Record<PermissionMatrixRoleSlot, string> = {
  manager: "Manager",
  coordination: "Coordination",
  supervisor: "Supervisor",
  lead: "Lead",
  operations: "Operations",
  team_member: "Team Member",
};

/** Maps matrix slot → legacy `role_feature_access` bucket (for sync + delegated edits). */
export function legacyRoleBucketForSlot(slot: PermissionMatrixRoleSlot): "manager" | "supervisor" | "lead" | "worker" {
  if (slot === "manager") return "manager";
  if (slot === "supervisor") return "supervisor";
  if (slot === "lead") return "lead";
  return "worker";
}

export function workspaceFeatureKeyForDepartment(dept: string): string {
  return `workspace_${dept}`;
}

export type PermissionFeatureGroup = { id: string; label: string; description?: string; keys: readonly string[] };

/** Feature toggles shown for the selected department (subset of contract). */
export function permissionFeatureGroupsForDepartment(dept: PermissionMatrixDepartment): PermissionFeatureGroup[] {
  const ws = workspaceFeatureKeyForDepartment(dept);
  const maintenanceOps = [
    "work_requests",
    "compliance",
    "inventory",
    "equipment",
    "monitoring",
    "projects",
  ] as const;
  const commsTools = [
    "comms_assets",
    "comms_advertising_mapper",
    "comms_publication_builder",
    "comms_indesign_pipeline",
    "comms_campaign_planner",
  ] as const;
  const sharedProgram = ["schedule", "team_management", "team_insights", "procedures", "messaging"] as const;
  const maps = ["drawings", "zones_devices", "live_map"] as const;

  if (dept === "maintenance") {
    return [
      { id: "hub", label: "Workspace access", description: "Allow this role to open the Maintenance workspace from Workspaces.", keys: [ws] },
      { id: "ops", label: "Maintenance & operations", description: "Classic Pulse modules for this department.", keys: [...maintenanceOps] },
      { id: "shared", label: "Scheduling, people & standards", keys: [...sharedProgram] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "communications") {
    return [
      { id: "hub", label: "Workspace access", description: "Allow this role to open the Communications workspace.", keys: [ws] },
      { id: "comms", label: "Communications tools", description: "Publication, campaigns, assets, and related tools.", keys: [...commsTools] },
      { id: "shared", label: "Scheduling, people & standards", keys: [...sharedProgram] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "aquatics") {
    return [
      { id: "hub", label: "Workspace access", keys: [ws] },
      { id: "pool", label: "Aquatics programs", description: "Scheduling and pool-facing tools.", keys: ["schedule"] },
      { id: "shared", label: "People & standards", keys: ["team_management", "team_insights", "procedures", "messaging"] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "reception") {
    return [
      { id: "hub", label: "Workspace access", keys: [ws] },
      { id: "shared", label: "People & standards", keys: [...sharedProgram] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "fitness" || dept === "racquets") {
    return [
      { id: "hub", label: "Workspace access", keys: [ws] },
      { id: "programs", label: "Programs & classes", keys: ["schedule"] },
      { id: "shared", label: "People & standards", keys: ["team_management", "team_insights", "procedures", "messaging"] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  return [{ id: "hub", label: "Workspace access", keys: [ws] }];
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

  return {
    manager: collect("manager"),
    supervisor: collect("supervisor"),
    lead: collect("lead"),
    worker: uniq([
      ...collect("coordination"),
      ...collect("operations"),
      ...collect("team_member"),
    ]),
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
    for (const s of PERMISSION_MATRIX_ROLE_SLOTS) {
      out[d][s] = [...pick(legacyRoleBucketForSlot(s))];
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
  const cat = new Set(contractCatalog);
  for (const d of PERMISSION_MATRIX_DEPARTMENTS) {
    const row = obj[d];
    if (!row || typeof row !== "object") continue;
    for (const s of PERMISSION_MATRIX_ROLE_SLOTS) {
      const list = row[s];
      if (Array.isArray(list)) {
        seed[d]![s] = list.map((x) => String(x)).filter((x) => cat.has(x));
      }
    }
  }
  return seed;
}
