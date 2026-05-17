/**
 * Client-side access debugger: sidebar visibility vs server effective_enabled_features.
 * Uses production `tenant-nav` helpers only — no parallel visibility rules.
 */
import {
  MASTER_FEATURES,
  NAV_VISIBLE_MASTER_FEATURES,
  type MasterFeatureDef,
} from "@/config/platform/master-feature-registry";
import type { AccessResolutionDebugPayload } from "@/lib/accessDebugService";
import { toCanonicalFeatureKey } from "@/lib/features/canonical-features";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { tenantSidebarNavItemsForLiveApp } from "@/lib/rbac/session-access";
import {
  explainMasterFeatureVisibility,
  tenantSidebarNavItemsForSession,
  type TenantSidebarNavItem,
} from "@/lib/rbac/tenant-nav";

export type NavFeatureDiagnosisRow = {
  registryKey: string;
  label: string;
  feature: string;
  canonicalFeature: string;
  inEnabledFeatures: boolean;
  inSimulatedSidebar: boolean;
  serverAttribution: string | null;
  missingServerExplanation: AccessResolutionDebugPayload["missing_feature_explanations"][number] | null;
  frontendHiddenReason: string | null;
  diagnosis: "granted_sidebar" | "granted_hidden_by_frontend" | "missing_server" | "not_on_contract_nav";
};

export type AccessNavDiagnosis = {
  simulatedSidebar: TenantSidebarNavItem[];
  sidebarKeys: Set<string>;
  enabledCanonical: Set<string>;
  rows: NavFeatureDiagnosisRow[];
  grantedSidebar: NavFeatureDiagnosisRow[];
  missingFeatures: NavFeatureDiagnosisRow[];
  frontendHidden: NavFeatureDiagnosisRow[];
  enabledButNotInNav: string[];
};

export function diagnoseAccessNav(
  debug: AccessResolutionDebugPayload,
  targetSession: PulseAuthSession,
): AccessNavDiagnosis {
  const simulatedSidebar = tenantSidebarNavItemsForLiveApp(targetSession);
  const sidebarKeys = new Set(simulatedSidebar.map((n) => n.key));
  const enabledCanonical = new Set(
    (debug.effective_enabled_features ?? []).map((k) => String(toCanonicalFeatureKey(k) ?? k)),
  );

  const missingByKey = new Map(
    (debug.missing_feature_explanations ?? []).map((m) => [
      String(toCanonicalFeatureKey(m.feature_key) ?? m.feature_key),
      m,
    ]),
  );

  const navFeatures = [...NAV_VISIBLE_MASTER_FEATURES].sort((a, b) => a.sortOrder - b.sortOrder);

  const rows: NavFeatureDiagnosisRow[] = navFeatures.map((f: MasterFeatureDef) => {
    const canon = String(toCanonicalFeatureKey(f.feature) ?? f.feature);
    const inEnabled = enabledCanonical.has(canon) || enabledCanonical.has(f.feature);
    const inSidebar = sidebarKeys.has(f.key);
    const ex = explainMasterFeatureVisibility(targetSession, f, false);
    const serverMiss = missingByKey.get(canon) ?? missingByKey.get(f.feature) ?? null;
    const attrib =
      debug.source_attribution[f.feature] ??
      debug.source_attribution[canon] ??
      null;

    let diagnosis: NavFeatureDiagnosisRow["diagnosis"] = "not_on_contract_nav";
    if (inSidebar) diagnosis = "granted_sidebar";
    else if (inEnabled && !inSidebar) diagnosis = "granted_hidden_by_frontend";
    else if (!inEnabled) diagnosis = "missing_server";

    return {
      registryKey: f.key,
      label: f.label,
      feature: f.feature,
      canonicalFeature: canon,
      inEnabledFeatures: inEnabled,
      inSimulatedSidebar: inSidebar,
      serverAttribution: attrib,
      missingServerExplanation: serverMiss,
      frontendHiddenReason: inSidebar ? null : ex.reason ?? null,
      diagnosis,
    };
  });

  const enabledButNotInNav = [...enabledCanonical].filter((k) => {
    const hasNav = navFeatures.some(
      (f) => f.feature === k || String(toCanonicalFeatureKey(f.feature) ?? f.feature) === k,
    );
    return hasNav && !navFeatures.some((f) => sidebarKeys.has(f.key) && (f.feature === k || toCanonicalFeatureKey(f.feature) === k));
  });

  return {
    simulatedSidebar,
    sidebarKeys,
    enabledCanonical,
    rows,
    grantedSidebar: rows.filter((r) => r.diagnosis === "granted_sidebar"),
    missingFeatures: rows.filter((r) => r.diagnosis === "missing_server"),
    frontendHidden: rows.filter((r) => r.diagnosis === "granted_hidden_by_frontend"),
    enabledButNotInNav,
  };
}

export function formatMissingReason(code: string): string {
  const labels: Record<string, string> = {
    filtered_by_contract: "Filtered by contract",
    disabled_in_matrix: "Disabled in matrix",
    slot_mismatch: "Matrix slot mismatch",
    matrix_cell_empty: "Matrix cell empty",
    overlay_ignored_under_matrix_primary: "Overlay ignored (matrix-primary)",
    feature_allow_extra_absent: "feature_allow_extra absent",
    legacy_fallback_skipped: "Legacy role bucket skipped",
    explicit_deny: "Explicit deny (no_access)",
    not_in_effective_enabled_features: "Not in effective enabled_features",
    unknown_feature_key: "Unknown feature key",
    admin_resolver_gap: "Admin resolver gap",
    frontend_sidebar_hidden: "Frontend sidebar hidden",
  };
  return labels[code] ?? code.replaceAll("_", " ");
}
