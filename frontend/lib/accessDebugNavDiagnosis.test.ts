import { describe, expect, it } from "vitest";
import type { AccessResolutionDebugPayload } from "@/lib/accessDebugService";
import { diagnoseAccessNav } from "@/lib/accessDebugNavDiagnosis";
import type { PulseAuthSession } from "@/lib/pulse-session";

function session(partial: Partial<PulseAuthSession>): PulseAuthSession {
  return {
    sub: "target",
    email: "t@test.com",
    iat: 0,
    exp: 9999999999,
    remember: false,
    ...partial,
  };
}

function debugPayload(partial: Partial<AccessResolutionDebugPayload>): AccessResolutionDebugPayload {
  return {
    user_id: "target",
    company_id: "c1",
    jwt_roles: ["worker"],
    hr_job_title: null,
    hr_department: null,
    hr_department_slugs: [],
    resolved_department: "communications",
    resolved_slot: "coordination",
    resolved_slot_source: "explicit_matrix_slot",
    hr_matrix_slot: "coordination",
    matrix_configured: true,
    matrix_row_department: "communications",
    matrix_row_slot: "coordination",
    matrix_cell_raw_features: ["inventory"],
    matrix_missing_cell: false,
    contract_features: ["dashboard", "inventory", "projects", "schedule"],
    matrix_features: ["inventory"],
    overlay_features: [],
    feature_allow_extra: [],
    feature_deny_extra: [],
    denied_by_contract: [],
    effective_enabled_features: ["inventory", "projects"],
    rbac_permission_keys: ["inventory.view", "inventory.manage"],
    tenant_role_id: null,
    tenant_role_slug: null,
    tenant_role_name: null,
    resolution_kind: "matrix_primary",
    source_attribution: {
      inventory: "matrix:communications+coordination",
      projects: "feature_allow_extra",
    },
    legacy_bucket: null,
    legacy_role_feature_access_features: [],
    resolution_steps: [],
    session_cache_info: null,
    warnings: [],
    missing_feature_explanations: [
      {
        feature_key: "schedule",
        expected_from: ["contract", "product_catalog"],
        denied_by: ["contract"],
        missing_reason: "filtered_by_contract",
        resolution_details: ["Feature is not licensed on the tenant contract."],
      },
      {
        feature_key: "monitoring",
        expected_from: ["contract"],
        denied_by: ["matrix"],
        missing_reason: "disabled_in_matrix",
        resolution_details: ["Matrix row does not include monitoring"],
      },
    ],
    candidate_feature_keys: ["dashboard", "inventory", "monitoring", "projects", "schedule"],
    missing_rbac_permission_keys: [],
    ...partial,
  };
}

describe("diagnoseAccessNav", () => {
  it("flags projects as enabled on server but hidden when RBAC missing", () => {
    const dbg = debugPayload({});
    const targetSession = session({
      contract_features: dbg.contract_features,
      enabled_features: dbg.effective_enabled_features,
      rbac_permissions: dbg.rbac_permission_keys,
    });
    const diag = diagnoseAccessNav(dbg, targetSession);
    const projects = diag.rows.find((r) => r.registryKey === "projects");
    expect(projects?.inEnabledFeatures).toBe(true);
    expect(projects?.inSimulatedSidebar).toBe(false);
    expect(projects?.diagnosis).toBe("granted_hidden_by_frontend");
    expect(diag.frontendHidden.some((r) => r.registryKey === "projects")).toBe(true);
  });

  it("maps server missing explanation onto nav row for schedule", () => {
    const dbg = debugPayload({});
    const targetSession = session({
      contract_features: dbg.contract_features,
      enabled_features: dbg.effective_enabled_features,
      rbac_permissions: dbg.rbac_permission_keys,
    });
    const sched = diagnoseAccessNav(dbg, targetSession).rows.find((r) => r.feature === "schedule");
    expect(sched?.missingServerExplanation?.missing_reason).toBe("filtered_by_contract");
  });
});
