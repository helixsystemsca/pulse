/**
 * Default module settings (keep aligned with `backend/app/core/org_module_settings_merge.py`).
 */
export const DEFAULT_ORG_MODULE_SETTINGS = {
  workRequests: {
    requirePhotoOnClose: false,
    autoAssignTechnician: false,
    enablePriorityLevels: true,
    lockAfterCompletion: false,
    allowManualOverride: true,
    /** Shown before the short id (e.g. ISS-194AC9). Letters, numbers, underscore; max 12 chars. */
    workItemCodePrefixIssue: "ISS",
    workItemCodePrefixPreventative: "PM",
    workItemCodePrefixSetup: "SET",
  },
  schedule: {
    allowShiftOverrides: true,
    enforceMaxHours: 0,
    autoGenerateShifts: false,
    coverageRules: [] as unknown[],
    enableNightAssignments: false,
    /** Tracked physical facilities for the schedule (1–20). Labels optional; see `facilityLabels`. */
    facilityCount: 1,
    /** Optional: one label per row; missing entries default to "Facility n". */
    facilityLabels: [] as string[],
  },
  assets: {
    requireSerialNumber: false,
    enableMaintenanceHistory: true,
    allowAssetHierarchy: true,
  },
  blueprint: {
    enableSnapping: true,
    showGrid: true,
    enableAutoConnect: true,
  },
  compliance: {
    requireManagerForEscalation: false,
    showRepeatOffenderHighlight: true,
    strictReviewDeadlines: false,
  },
} as const;

export type ModuleId = keyof typeof DEFAULT_ORG_MODULE_SETTINGS;

export type OrgModuleSettingsRoot = {
  [K in ModuleId]: (typeof DEFAULT_ORG_MODULE_SETTINGS)[K];
};

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const k of Object.keys(patch)) {
    const key = k as keyof T;
    const pv = patch[key];
    if (pv === undefined) continue;
    const bv = out[key as string];
    if (
      pv &&
      typeof pv === "object" &&
      !Array.isArray(pv) &&
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      out[key as string] = deepMerge(bv as Record<string, unknown>, pv as Record<string, unknown>);
    } else {
      out[key as string] = pv as unknown;
    }
  }
  return out as T;
}

export function mergeOrgModuleSettings(stored: Partial<OrgModuleSettingsRoot> | null | undefined): OrgModuleSettingsRoot {
  const base = structuredClone(DEFAULT_ORG_MODULE_SETTINGS) as unknown as OrgModuleSettingsRoot;
  if (!stored || typeof stored !== "object") return base;
  return deepMerge(base, stored as Partial<OrgModuleSettingsRoot>);
}
