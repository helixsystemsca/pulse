/**
 * Canonical access snapshot from `/auth/me` — single source for client authorization checks.
 */
import { LEGACY_PLATFORM_ROUTE_ALIASES } from "@/config/platform/legacy-platform-routes";
import { MASTER_FEATURES, type MasterFeatureDef } from "@/config/platform/master-feature-registry";
import { isPlatformDepartmentSlug } from "@/config/platform/departments";
import type { PulseAuthSession } from "@/lib/pulse-session";

export type AccessSnapshotAudit = {
  matrix_slot_source: string;
  matrix_slot_inferred: boolean;
  hr_matrix_slot?: string | null;
  resolution_warnings?: string[];
  denied_by_contract?: string[];
  contract_features?: string[];
};

export type AccessSnapshot = {
  department: string;
  matrix_slot: string;
  features: string[];
  capabilities: string[];
  departments: string[];
  is_company_admin: boolean;
  workers_roster_access?: boolean;
  contract_features?: string[];
  denied_features?: string[];
  audit?: AccessSnapshotAudit | null;
};

function featureEnabledInSnapshot(snap: AccessSnapshot, featureKey: string): boolean {
  if (snap.features.includes("*")) return true;
  return snap.features.includes(featureKey);
}

function capabilityGranted(snap: AccessSnapshot, key: string): boolean {
  if (snap.capabilities.includes("*")) return true;
  return snap.capabilities.includes(key);
}

/** Read canonical snapshot from session, or synthesize from legacy `/auth/me` fields. */
export function readAccessSnapshot(session: PulseAuthSession | null): AccessSnapshot | null {
  if (!session) return null;
  if (session.access_snapshot) return session.access_snapshot;

  if (!session.enabled_features?.length && !session.rbac_permissions?.length) {
    if (!session.is_system_admin && session.role !== "system_admin") return null;
  }

  return {
    department: session.hr_department ?? "maintenance",
    matrix_slot: "team_member",
    features: [...(session.enabled_features ?? [])],
    capabilities: [...(session.rbac_permissions ?? [])],
    departments: session.hr_department ? [session.hr_department] : [],
    is_company_admin:
      session.facility_tenant_admin === true ||
      session.role === "company_admin" ||
      Boolean(session.roles?.includes("company_admin")),
    workers_roster_access: session.workers_roster_access,
    contract_features: [...(session.contract_features ?? [])],
    audit: {
      matrix_slot_source: "fallback_default",
      matrix_slot_inferred: true,
      resolution_warnings: ["Session missing access_snapshot — using legacy enabled_features."],
    },
  };
}

export function snapshotHasCapability(snapshot: AccessSnapshot | null, permissionKey: string): boolean {
  if (!snapshot) return false;
  return capabilityGranted(snapshot, permissionKey);
}

export function snapshotHasFeature(snapshot: AccessSnapshot | null, featureKey: string): boolean {
  if (!snapshot) return false;
  if (snapshot.is_company_admin) {
    const contract = new Set(snapshot.contract_features ?? []);
    return contract.has(featureKey) || snapshot.features.includes(featureKey);
  }
  return featureEnabledInSnapshot(snapshot, featureKey);
}

export function userBelongsToDepartment(snapshot: AccessSnapshot | null, departmentSlug: string): boolean {
  if (!snapshot) return false;
  if (snapshot.is_company_admin) return true;
  if (!snapshot.departments.length) return snapshot.department === departmentSlug;
  return snapshot.departments.includes(departmentSlug);
}

function masterModuleAllowedForDepartment(
  snapshot: AccessSnapshot,
  f: MasterFeatureDef,
  departmentSlug: string,
): boolean {
  if (f.platformDepartmentSlug && f.platformDepartmentSlug !== departmentSlug) return false;
  if (!f.platformDepartmentSlug && f.platformRoute) return false;
  if (!snapshotHasFeature(snapshot, f.feature)) return false;
  if (!f.rbacAnyOf.length) return true;
  return f.rbacAnyOf.some((k) => capabilityGranted(snapshot, k));
}

/**
 * Department workspace modules: HR membership + snapshot features/capabilities for that department.
 */
export function getDepartmentAccessibleFeatures(
  departmentSlug: string,
  snapshot: AccessSnapshot | null,
): string[] {
  if (!snapshot || !isPlatformDepartmentSlug(departmentSlug)) return [];
  if (snapshot.is_company_admin || snapshot.capabilities.includes("*")) {
    const feats = new Set<string>();
    for (const f of MASTER_FEATURES) {
      if (f.platformDepartmentSlug === departmentSlug) feats.add(f.feature);
    }
    for (const leg of LEGACY_PLATFORM_ROUTE_ALIASES) {
      if (leg.departmentSlug === departmentSlug) feats.add(leg.feature);
    }
    return [...feats];
  }
  if (!userBelongsToDepartment(snapshot, departmentSlug)) return [];

  const out = new Set<string>();
  for (const f of MASTER_FEATURES) {
    if (masterModuleAllowedForDepartment(snapshot, f, departmentSlug)) out.add(f.feature);
  }
  for (const leg of LEGACY_PLATFORM_ROUTE_ALIASES) {
    if (leg.departmentSlug !== departmentSlug) continue;
    if (!snapshotHasFeature(snapshot, leg.feature)) continue;
    if (!leg.rbacAnyOf.some((k) => capabilityGranted(snapshot, k))) continue;
    out.add(leg.feature);
  }
  return [...out];
}

export function departmentWorkspaceAllowed(
  session: PulseAuthSession | null,
  departmentSlug: string,
): boolean {
  if (!session || !isPlatformDepartmentSlug(departmentSlug)) return false;
  if (session.is_system_admin || session.role === "system_admin") return true;
  const snap = readAccessSnapshot(session);
  return getDepartmentAccessibleFeatures(departmentSlug, snap).length > 0;
}

export function matrixSlotInferred(snapshot: AccessSnapshot | null): boolean {
  return Boolean(snapshot?.audit?.matrix_slot_inferred);
}
