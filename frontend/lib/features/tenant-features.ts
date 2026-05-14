/**
 * Tenant feature enablement from `/auth/me` (company contract).
 * Aligns with backend `company_features` / `GLOBAL_SYSTEM_FEATURES`.
 */
import type { PulseAuthSession } from "@/lib/pulse-session";

/** Enabled contract module keys for this signed-in tenant user. */
export function tenantEnabledFeatures(session: PulseAuthSession | null): readonly string[] {
  if (!session) return [];
  if (session.contract_features?.length) return session.contract_features;
  if (session.contract_enabled_features?.length) return session.contract_enabled_features;
  return [];
}

export function tenantEnabledFeatureSet(session: PulseAuthSession | null): Set<string> {
  return new Set(tenantEnabledFeatures(session));
}

export function isTenantFeatureEnabled(session: PulseAuthSession | null, featureKey: string): boolean {
  return tenantEnabledFeatureSet(session).has(featureKey);
}
