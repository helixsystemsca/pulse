/**
 * Canonical product feature keys — role toggles, sidebar, Team Management.
 * Must stay aligned with `backend/app/core/features/canonical_catalog.py`.
 */
export const CANONICAL_PRODUCT_FEATURES = [
  "dashboard",
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
  "projects",
  "work_requests",
  "procedures",
  "messaging",
  "comms_assets",
  "comms_publication_builder",
  "comms_campaign_planner",
] as const;

export type CanonicalFeatureKey = (typeof CANONICAL_PRODUCT_FEATURES)[number];

/** Legacy contract / DB keys → canonical role keys. */
export const LEGACY_CONTRACT_TO_CANONICAL: Record<string, CanonicalFeatureKey> = {
  compliance: "logs_inspections",
  comms_advertising_mapper: "advertising_mapper",
  comms_indesign_pipeline: "xplor_indesign",
};

/** Canonical → legacy contract key in `company_features` / `contract_features`. */
export const CANONICAL_TO_CONTRACT: Partial<Record<CanonicalFeatureKey, string>> = {
  logs_inspections: "compliance",
  advertising_mapper: "comms_advertising_mapper",
  xplor_indesign: "comms_indesign_pipeline",
  standards: "procedures",
};

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
 * canonical equivalents, and paired legacy contract keys (`compliance` ↔ `logs_inspections`, …).
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
  return s;
}
