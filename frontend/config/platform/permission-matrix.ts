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

export type PermissionFeatureGroup = { id: string; label: string; description?: string; keys: readonly string[] };

/** Keys mirrored across departments — master Team Management matrix lists every module once. */
const MAINTENANCE_OPS_KEYS = [
  "work_requests",
  "compliance",
  "inventory",
  "equipment",
  "monitoring",
  "projects",
] as const;

const COMMS_TOOLS_KEYS = [
  "comms_assets",
  "comms_advertising_mapper",
  "comms_publication_builder",
  "comms_indesign_pipeline",
  "comms_campaign_planner",
] as const;

const LEADERSHIP_KEYS = ["dashboard"] as const;

const SHARED_PROGRAM_KEYS = ["schedule", "team_management", "team_insights", "procedures", "messaging"] as const;

const MAP_KEYS = ["drawings", "zones_devices", "live_map"] as const;

/** Single catalog for company admins — underlying rows are duplicated per workspace department on save. */
export const MASTER_PERMISSION_FEATURE_GROUPS: PermissionFeatureGroup[] = [
  {
    id: "dashboard",
    label: "Leadership dashboard",
    description: "Main operations / leadership overview (/overview).",
    keys: [...LEADERSHIP_KEYS],
  },
  {
    id: "ops",
    label: "Maintenance & operations",
    description: "Work requests, inspections, inventory, equipment, monitoring, and projects.",
    keys: [...MAINTENANCE_OPS_KEYS],
  },
  {
    id: "comms",
    label: "Communications tools",
    description: "Publication pipeline, campaigns, assets, advertising mapper, and InDesign export.",
    keys: [...COMMS_TOOLS_KEYS],
  },
  {
    id: "shared",
    label: "Scheduling, people & standards",
    keys: [...SHARED_PROGRAM_KEYS],
  },
  {
    id: "maps",
    label: "Maps, drawings & devices",
    keys: [...MAP_KEYS],
  },
];

/** Canonical department row duplicated to every key in `department_role_feature_access` on save. */
export const MASTER_PERMISSION_MATRIX_DEPARTMENT: PermissionMatrixDepartment = "maintenance";

/** Feature toggles shown for the selected department (subset of contract). */
export function permissionFeatureGroupsForDepartment(dept: PermissionMatrixDepartment): PermissionFeatureGroup[] {
  const maintenanceOps = MAINTENANCE_OPS_KEYS;
  const commsTools = COMMS_TOOLS_KEYS;
  const leadership = LEADERSHIP_KEYS;
  const sharedProgram = SHARED_PROGRAM_KEYS;
  const maps = MAP_KEYS;

  if (dept === "maintenance") {
    return [
      {
        id: "dashboard",
        label: "Leadership dashboard",
        description: "Main operations / leadership overview (/overview).",
        keys: [...leadership],
      },
      { id: "ops", label: "Maintenance & operations", description: "Classic Pulse modules for this department.", keys: [...maintenanceOps] },
      { id: "shared", label: "Scheduling, people & standards", keys: [...sharedProgram] },
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
      { id: "comms", label: "Communications tools", description: "Publication, campaigns, assets, and related tools.", keys: [...commsTools] },
      { id: "shared", label: "Scheduling, people & standards", keys: [...sharedProgram] },
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
      { id: "pool", label: "Aquatics programs", description: "Scheduling and pool-facing tools.", keys: ["schedule"] },
      { id: "shared", label: "People & standards", keys: ["team_management", "team_insights", "procedures", "messaging"] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "reception") {
    return [
      {
        id: "dashboard",
        label: "Leadership dashboard",
        description: "Main operations / leadership overview (/overview).",
        keys: [...leadership],
      },
      { id: "shared", label: "People & standards", keys: [...sharedProgram] },
      { id: "maps", label: "Maps, drawings & devices", keys: [...maps] },
    ];
  }
  if (dept === "fitness" || dept === "racquets") {
    return [
      {
        id: "dashboard",
        label: "Leadership dashboard",
        description: "Main operations / leadership overview (/overview).",
        keys: [...leadership],
      },
      { id: "programs", label: "Programs & classes", keys: ["schedule"] },
      { id: "shared", label: "People & standards", keys: ["team_management", "team_insights", "procedures", "messaging"] },
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

/**
 * Pick one authoritative slot map (prefer maintenance), copy to every department row so HR workspace
 * routing always sees the same permission answers Lisa expects from the master matrix UI.
 */
export function unifyDepartmentRoleMatrixForMasterUi(
  matrix: Record<string, Record<string, string[]>>,
): Record<string, Record<string, string[]>> {
  const masterDept = MASTER_PERMISSION_MATRIX_DEPARTMENT;
  const emptySlots = (): Record<string, string[]> =>
    Object.fromEntries(PERMISSION_MATRIX_ROLE_SLOTS.map((s) => [s, [] as string[]])) as Record<
      PermissionMatrixRoleSlot,
      string[]
    >;

  const pickSourceRow = (): Record<string, string[]> => {
    const m = matrix[masterDept];
    if (m && typeof m === "object") {
      return PERMISSION_MATRIX_ROLE_SLOTS.reduce(
        (acc, s) => {
          acc[s] = [...(m[s] ?? [])];
          return acc;
        },
        {} as Record<PermissionMatrixRoleSlot, string[]>,
      );
    }
    for (const d of PERMISSION_MATRIX_DEPARTMENTS) {
      const row = matrix[d];
      if (!row || typeof row !== "object") continue;
      return PERMISSION_MATRIX_ROLE_SLOTS.reduce(
        (acc, s) => {
          acc[s] = [...(row[s] ?? [])];
          return acc;
        },
        {} as Record<PermissionMatrixRoleSlot, string[]>,
      );
    }
    return emptySlots();
  };

  const slots = pickSourceRow();
  const out: Record<string, Record<string, string[]>> = {};
  for (const d of PERMISSION_MATRIX_DEPARTMENTS) {
    out[d] = {};
    for (const s of PERMISSION_MATRIX_ROLE_SLOTS) {
      out[d][s] = [...(slots[s] ?? [])];
    }
  }
  return out;
}

/** Toggle one module for a role-slot across every department row (single master matrix). */
export function toggleModuleAcrossDepartmentMatrix(
  prev: Record<string, Record<string, string[]>>,
  slot: PermissionMatrixRoleSlot,
  mod: string,
): Record<string, Record<string, string[]>> {
  const next: Record<string, Record<string, string[]>> = { ...prev };
  for (const d of PERMISSION_MATRIX_DEPARTMENTS) {
    const row = { ...(next[d] ?? {}) };
    const cur = new Set(row[slot] ?? []);
    if (cur.has(mod)) cur.delete(mod);
    else cur.add(mod);
    row[slot] = [...cur].sort();
    next[d] = row;
  }
  return next;
}
