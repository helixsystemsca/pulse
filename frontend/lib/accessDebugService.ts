import { apiFetch } from "@/lib/api";

export type MissingFeatureExplanation = {
  feature_key: string;
  expected_from: string[];
  denied_by: string[];
  missing_reason: string;
  resolution_details: string[];
};

/** Mirrors `backend/app/schemas/access_debug.py`. */
export type AccessResolutionDebugPayload = {
  user_id: string;
  company_id: string | null;
  jwt_roles: string[];

  hr_job_title: string | null;
  hr_department: string | null;
  hr_department_slugs: string[];

  resolved_department: string | null;
  resolved_slot: string | null;
  resolved_slot_source: string;
  user_job_title?: string | null;
  effective_job_title?: string | null;
  policy_suppressed?: boolean;
  suppressed_inferred_slot?: string | null;
  matrix_slot_display?: string;
  likely_elevated?: boolean;
  likely_elevated_reasons?: string[];
  recommended_matrix_slot?: string | null;
  matrix_slot_inference_trace?: string[];
  require_explicit_elevated_slots?: boolean;
  hr_matrix_slot: string | null;

  matrix_configured: boolean;
  matrix_row_department: string | null;
  matrix_row_slot: string | null;
  matrix_cell_raw_features: string[];
  matrix_missing_cell: boolean;

  contract_features: string[];
  matrix_features: string[];
  overlay_features: string[];
  feature_allow_extra: string[];
  feature_deny_extra: string[];

  denied_by_contract: string[];

  effective_enabled_features: string[];
  rbac_permission_keys: string[];

  tenant_role_id: string | null;
  tenant_role_slug: string | null;
  tenant_role_name: string | null;

  resolution_kind: string;
  source_attribution: Record<string, string>;

  legacy_bucket: string | null;
  legacy_role_feature_access_features: string[];

  resolution_steps: string[];
  session_cache_info: Record<string, unknown> | null;
  warnings: string[];

  missing_feature_explanations: MissingFeatureExplanation[];
  candidate_feature_keys: string[];
  missing_rbac_permission_keys: string[];
};

export async function fetchAccessResolutionDebug(userId: string): Promise<AccessResolutionDebugPayload> {
  return apiFetch<AccessResolutionDebugPayload>(`/api/v1/debug/access/${encodeURIComponent(userId)}`);
}

export type { ResolvedAccessAudit, FeatureResolutionLogEntry } from "@/lib/rbac/debugResolvedAccess";
export { debugResolvedAccess, auditSessionAccessLocally, logSidebarResolution } from "@/lib/rbac/debugResolvedAccess";
