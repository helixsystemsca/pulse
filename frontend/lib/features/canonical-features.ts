/**
 * Canonical product feature keys — role toggles, sidebar, Team Management.
 * Must stay aligned with `backend/app/core/features/canonical_catalog.py`.
 */
import { expandMatrixLicensableKeys } from "@/lib/features/matrix-nav-features";

export const CANONICAL_PRODUCT_FEATURES = [
  "dashboard",
  "dashboard_operations",
  "dashboard_leadership",
  "dashboard_project",
  "dashboard_inspections",
  "dashboard_team_insights",
  "dashboard_kiosk",
  "dashboard_dept_communications",
  "dashboard_dept_aquatics",
  "dashboard_dept_reception",
  "dashboard_dept_fitness",
  "dashboard_dept_racquets",
  "dashboard_dept_admin",
  "monitoring",
  "logs_inspections",
  "inventory",
  "standards",
  "team_management",
  "team_insights",
  "equipment",
  "live_map",
  "zones_devices",
  "advertising_mapper",
  "xplor_indesign",
  "drawings",
  "schedule",
  "schedule_availability",
  "schedule_coverage",
  "schedule_shift_definitions",
  "projects",
  "pm_workspace",
  "pm_planning",
  "work_requests",
  "procedures",
  "standards_training",
  "standards_certifications",
  "standards_compliance",
  "standards_my_procedures",
  "standards_routines",
  "standards_acknowledgments",
  "facilities_spatial",
  "spatial_infrastructure",
  "messaging",
  "comms_assets",
  "comms_campaign_planner",
] as const;

export type CanonicalFeatureKey = (typeof CANONICAL_PRODUCT_FEATURES)[number];

/** Legacy contract / DB keys → canonical role keys. */
export const LEGACY_CONTRACT_TO_CANONICAL: Record<string, CanonicalFeatureKey> = {
  compliance: "logs_inspections",
  comms_advertising_mapper: "advertising_mapper",
  comms_indesign_pipeline: "xplor_indesign",
  comms_publication_builder: "xplor_indesign",
};

/** Canonical → legacy contract key in `company_features` / `contract_features`. */
export const CANONICAL_TO_CONTRACT: Partial<Record<CanonicalFeatureKey, string>> = {
  dashboard_operations: "dashboard",
  dashboard_leadership: "dashboard",
  dashboard_project: "dashboard",
  dashboard_inspections: "dashboard",
  dashboard_team_insights: "dashboard",
  dashboard_kiosk: "dashboard",
  dashboard_dept_communications: "dashboard",
  dashboard_dept_aquatics: "dashboard",
  dashboard_dept_reception: "dashboard",
  dashboard_dept_fitness: "dashboard",
  dashboard_dept_racquets: "dashboard",
  dashboard_dept_admin: "dashboard",
  logs_inspections: "compliance",
  advertising_mapper: "comms_advertising_mapper",
  xplor_indesign: "comms_indesign_pipeline",
  standards: "procedures",
  standards_training: "procedures",
  standards_certifications: "procedures",
  standards_compliance: "procedures",
  standards_my_procedures: "procedures",
  standards_routines: "procedures",
  standards_acknowledgments: "procedures",
  schedule_availability: "schedule",
  schedule_coverage: "schedule",
  schedule_shift_definitions: "schedule",
  pm_workspace: "projects",
  pm_planning: "projects",
  facilities_spatial: "drawings",
  spatial_infrastructure: "drawings",
};

const STANDARDS_SUB_FEATURES: readonly CanonicalFeatureKey[] = [
  "standards_training",
  "standards_certifications",
  "standards_compliance",
];

export function toCanonicalFeatureKey(name: string): CanonicalFeatureKey | null {
  const n = name.trim();
  if ((CANONICAL_PRODUCT_FEATURES as readonly string[]).includes(n)) {
    return n as CanonicalFeatureKey;
  }
  const mapped = LEGACY_CONTRACT_TO_CANONICAL[n];
  return mapped ?? null;
}

export function contractKeyForCanonical(key: CanonicalFeatureKey): string {
  return CANONICAL_TO_CONTRACT[key] ?? key;
}

export function contractKeysForCanonical(keys: Iterable<CanonicalFeatureKey | string>): string[] {
  const out = new Set<string>();
  for (const raw of keys) {
    const c = toCanonicalFeatureKey(String(raw));
    if (!c) continue;
    out.add(contractKeyForCanonical(c));
  }
  return [...out].sort();
}

export function canonicalizeFeatureKeys(names: Iterable<string>): CanonicalFeatureKey[] {
  const out = new Set<CanonicalFeatureKey>();
  for (const raw of names) {
    const c = toCanonicalFeatureKey(String(raw));
    if (c) out.add(c);
  }
  return [...out].sort();
}

/**
 * Expand contract feature names for permission-matrix filtering: include raw keys,
 * canonical equivalents, paired legacy contract keys, and flyout children (licensable, not auto-on).
 */
export function expandContractKeysForMatrixFilter(catalog: readonly string[]): Set<string> {
  const s = new Set<string>();
  for (const raw of catalog) {
    const t = String(raw).trim();
    if (!t) continue;
    s.add(t);
    const c = toCanonicalFeatureKey(t);
    if (c) {
      s.add(c);
      const legacy = CANONICAL_TO_CONTRACT[c];
      if (legacy) s.add(legacy);
    }
  }
  for (const key of expandMatrixLicensableKeys(catalog)) {
    s.add(key);
    const c = toCanonicalFeatureKey(key);
    if (c) {
      s.add(c);
      const legacy = CANONICAL_TO_CONTRACT[c];
      if (legacy) s.add(legacy);
    }
  }
  return s;
}

/** Contract modules → all canonical keys the tenant may license (for capability ∩). */
export function canonicalKeysFromContractExpanded(catalog: readonly string[]): CanonicalFeatureKey[] {
  const s = new Set<CanonicalFeatureKey>();
  for (const key of expandMatrixLicensableKeys(catalog)) {
    const c = toCanonicalFeatureKey(key);
    if (c) s.add(c);
  }
  for (const raw of catalog) {
    const c = toCanonicalFeatureKey(String(raw));
    if (c) s.add(c);
  }
  return [...s].sort();
}
