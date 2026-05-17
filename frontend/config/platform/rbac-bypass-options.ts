/**
 * Per-worker permission bypass UI — maps product features to RBAC keys granted per level.
 */

export type RbacBypassLevel = {
  id: string;
  label: string;
  keys: readonly string[];
};

export type RbacBypassFeature = {
  featureKey: string;
  label: string;
  levels: readonly RbacBypassLevel[];
};

export const RBAC_BYPASS_FEATURES: readonly RbacBypassFeature[] = [
  {
    featureKey: "work_requests",
    label: "Work requests",
    levels: [
      { id: "view", label: "View only", keys: ["work_requests.view"] },
      { id: "edit", label: "Edit & create", keys: ["work_requests.view", "work_requests.edit"] },
    ],
  },
  {
    featureKey: "procedures",
    label: "Procedures / standards",
    levels: [
      { id: "view", label: "View only", keys: ["procedures.view"] },
      { id: "edit", label: "Edit & publish", keys: ["procedures.view", "procedures.edit"] },
    ],
  },
  {
    featureKey: "inventory",
    label: "Inventory",
    levels: [
      { id: "view", label: "View only", keys: ["inventory.view"] },
      { id: "manage", label: "Manage", keys: ["inventory.view", "inventory.manage"] },
    ],
  },
  {
    featureKey: "equipment",
    label: "Equipment",
    levels: [
      { id: "view", label: "View only", keys: ["equipment.view"] },
      { id: "manage", label: "Manage", keys: ["equipment.view", "equipment.manage"] },
    ],
  },
  {
    featureKey: "compliance",
    label: "Inspections & compliance",
    levels: [
      { id: "view", label: "View only", keys: ["compliance.view"] },
      { id: "manage", label: "Manage", keys: ["compliance.view", "compliance.manage"] },
    ],
  },
  {
    featureKey: "drawings",
    label: "Drawings / infrastructure maps",
    levels: [{ id: "view", label: "View", keys: ["drawings.view"] }],
  },
  {
    featureKey: "team_management",
    label: "Team management",
    levels: [{ id: "view", label: "View", keys: ["team_management.view"] }],
  },
  {
    featureKey: "schedule",
    label: "Scheduling",
    levels: [{ id: "view", label: "View", keys: ["schedule.view"] }],
  },
  {
    featureKey: "monitoring",
    label: "Monitoring",
    levels: [{ id: "view", label: "View", keys: ["monitoring.view"] }],
  },
  {
    featureKey: "projects",
    label: "Projects",
    levels: [{ id: "view", label: "View", keys: ["projects.view"] }],
  },
  {
    featureKey: "comms_advertising_mapper",
    label: "Advertisement mapping",
    levels: [{ id: "view", label: "View", keys: ["arena_advertising.view"] }],
  },
] as const;

const ALL_KNOWN_KEYS = new Set(
  RBAC_BYPASS_FEATURES.flatMap((f) => f.levels.flatMap((l) => l.keys)),
);

export function rbacKeysFromBypassRows(
  rows: readonly { featureKey: string; levelId: string }[],
): string[] {
  const out = new Set<string>();
  for (const row of rows) {
    const feat = RBAC_BYPASS_FEATURES.find((f) => f.featureKey === row.featureKey);
    const level = feat?.levels.find((l) => l.id === row.levelId);
    if (level) {
      for (const k of level.keys) out.add(k);
    }
  }
  return [...out].filter((k) => ALL_KNOWN_KEYS.has(k)).sort();
}

export function bypassRowsFromRbacKeys(keys: readonly string[]): { featureKey: string; levelId: string }[] {
  const keySet = new Set(keys);
  const rows: { featureKey: string; levelId: string }[] = [];
  for (const feat of RBAC_BYPASS_FEATURES) {
    const match = [...feat.levels].reverse().find((level) => level.keys.every((k) => keySet.has(k)));
    if (match) {
      rows.push({ featureKey: feat.featureKey, levelId: match.id });
    }
  }
  return rows;
}

/** Module keys implied by bypass rows (for feature_allow_extra when view is granted). */
export function moduleKeysFromBypassRows(
  rows: readonly { featureKey: string; levelId: string }[],
): string[] {
  const mods = new Set<string>();
  for (const row of rows) {
    mods.add(row.featureKey);
  }
  return [...mods].sort();
}
