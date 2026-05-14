/**
 * Tenant feature enablement from `/auth/me`.
 * - `contract_features`: modules on the tenant contract (system admin).
 * - `enabled_features`: canonical keys granted via the user's tenant role.
 */
import {
  canonicalizeFeatureKeys,
  contractKeyForCanonical,
  toCanonicalFeatureKey,
  type CanonicalFeatureKey,
} from "@/lib/features/canonical-features";
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

/** Sidebar / route visibility: role grant ∩ contract. */
export function isUserFeatureEnabled(session: PulseAuthSession | null, featureKey: string): boolean {
  if (!session) return false;
  const canonical = toCanonicalFeatureKey(featureKey) ?? (featureKey as CanonicalFeatureKey);
  if (!isTenantFeatureOnContract(session, featureKey)) return false;
  const enabled = userEnabledFeatureSet(session);
  if (enabled.has(canonical)) return true;
  return enabled.has(featureKey as CanonicalFeatureKey);
}
