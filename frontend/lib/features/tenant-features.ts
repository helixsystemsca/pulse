/**
 * Tenant feature enablement from `/auth/me`.
 * - `contract_features`: modules on the tenant contract (system admin).
 * - `enabled_features`: matrix ∪ explicit per-worker extras ∩ contract (`no_access` overlay still denies all).
 */
import {
  canonicalizeFeatureKeys,
  canonicalKeysFromContractExpanded,
  contractKeyForCanonical,
  contractKeysForCanonical,
  toCanonicalFeatureKey,
  type CanonicalFeatureKey,
} from "@/lib/features/canonical-features";
import { readAccessSnapshot, snapshotHasFeature } from "@/lib/access-snapshot";
import type { PulseAuthSession } from "@/lib/pulse-session";

/** Tenant contract module keys (legacy catalog names). */
export function tenantEnabledFeatures(session: PulseAuthSession | null): readonly string[] {
  if (!session) return [];
  if (session.contract_features?.length) return session.contract_features;
  if (session.contract_enabled_features?.length) return session.contract_enabled_features;
  return [];
}

export function tenantEnabledFeatureSet(session: PulseAuthSession | null): Set<string> {
  return new Set(tenantEnabledFeatures(session));
}

/** Contract includes this module (canonical or legacy contract key). */
export function isTenantFeatureOnContract(session: PulseAuthSession | null, featureKey: string): boolean {
  const contract = tenantEnabledFeatureSet(session);
  if (contract.has(featureKey)) return true;
  const canonical = toCanonicalFeatureKey(featureKey);
  if (canonical) {
    const legacy = contractKeyForCanonical(canonical);
    if (contract.has(legacy)) return true;
  }
  return false;
}

/** @deprecated Prefer `isUserFeatureEnabled` for nav; kept for contract-only checks. */
export function isTenantFeatureEnabled(session: PulseAuthSession | null, featureKey: string): boolean {
  return isTenantFeatureOnContract(session, featureKey);
}

/** Role-granted canonical keys from `/auth/me` `enabled_features`. */
export function userEnabledCanonicalFeatures(session: PulseAuthSession | null): readonly CanonicalFeatureKey[] {
  if (!session?.enabled_features?.length) return [];
  return canonicalizeFeatureKeys(session.enabled_features);
}

export function userEnabledFeatureSet(session: PulseAuthSession | null): Set<CanonicalFeatureKey> {
  return new Set(userEnabledCanonicalFeatures(session));
}

const STANDARDS_SUB_FEATURES = ["standards_training", "standards_certifications", "standards_compliance"] as const;

const PM_LEGACY_MATRIX_KEYS = ["pm_workspace", "pm_planning"] as const;

function projectManagementMatrixEnabled(enabled: Set<CanonicalFeatureKey>): boolean {
  if (enabled.has("project_management")) return true;
  return PM_LEGACY_MATRIX_KEYS.some((k) => enabled.has(k));
}

function legacyStandardsBundleEnabled(session: PulseAuthSession | null, enabled: Set<CanonicalFeatureKey>): boolean {
  return enabled.has("procedures") || enabled.has("standards");
}

function canonicalFeatureOnContract(session: PulseAuthSession | null, featureKey: string): boolean {
  if (isTenantFeatureOnContract(session, featureKey)) return true;
  const canonical = toCanonicalFeatureKey(featureKey);
  if (!canonical) return false;
  const expanded = new Set(canonicalKeysFromContractExpanded(tenantEnabledFeatures(session)));
  if (expanded.has(canonical)) return true;
  for (const contractKey of contractKeysForCanonical([canonical])) {
    if (isTenantFeatureOnContract(session, contractKey)) return true;
  }
  return false;
}

/** Sidebar / route visibility: canonical snapshot features (already ∩ contract). */
export function isUserFeatureEnabled(session: PulseAuthSession | null, featureKey: string): boolean {
  if (!session) return false;
  const snap = readAccessSnapshot(session);
  if (snap) {
    if (snapshotHasFeature(snap, featureKey)) return true;
    if (
      featureKey === "project_management" &&
      (snap.features.includes("project_management") ||
        snap.features.includes("pm_workspace") ||
        snap.features.includes("pm_planning"))
    ) {
      return true;
    }
    if ((STANDARDS_SUB_FEATURES as readonly string[]).includes(featureKey)) {
      return snapshotHasFeature(snap, "procedures") || snapshotHasFeature(snap, "standards");
    }
    return false;
  }
  const canonical = toCanonicalFeatureKey(featureKey) ?? (featureKey as CanonicalFeatureKey);
  if (!canonicalFeatureOnContract(session, featureKey)) return false;
  const enabled = userEnabledFeatureSet(session);
  if (enabled.has(canonical)) return true;
  if (featureKey === "project_management" && projectManagementMatrixEnabled(enabled)) return true;
  if (featureKey.startsWith("dashboard_") && enabled.has("dashboard")) return true;
  if ((STANDARDS_SUB_FEATURES as readonly string[]).includes(featureKey) && legacyStandardsBundleEnabled(session, enabled)) {
    return true;
  }
  return enabled.has(featureKey as CanonicalFeatureKey);
}
