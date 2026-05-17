/**
 * Tenant sidebar — master registry → contract → effective `enabled_features` (default deny).
 */
import { normalizeModuleCategory } from "@/config/platform/module-categories";
import {
  MASTER_FEATURES,
  NAV_VISIBLE_MASTER_FEATURES,
  type MasterFeatureDef,
  type MasterFeatureIcon,
} from "@/config/platform/master-feature-registry";
import { readAccessSnapshot, snapshotHasCapability, snapshotHasFeature } from "@/lib/access-snapshot";
import { isTenantFeatureOnContract, isUserFeatureEnabled } from "@/lib/features/tenant-features";
import type { PulseAuthSession } from "@/lib/pulse-session";

function hasRbacPermission(session: PulseAuthSession | null, permissionKey: string): boolean {
  const snap = readAccessSnapshot(session);
  if (snap) return snapshotHasCapability(snap, permissionKey);
  const rbac = session?.rbac_permissions;
  if (!rbac?.length) return false;
  return rbac.includes("*") || rbac.includes(permissionKey);
}

export function isTenantFullAdminSession(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  return (
    session.facility_tenant_admin === true ||
    session.role === "company_admin" ||
    Boolean(session.roles?.includes("company_admin"))
  );
}

function canShowTeamManagement(session: PulseAuthSession | null, isSystemAdmin: boolean): boolean {
  if (!session) return false;
  if (isSystemAdmin) return true;
  if (session.workers_roster_access === true) return true;
  if (isTenantFullAdminSession(session)) return true;
  return isUserFeatureEnabled(session, "team_management") && hasRbacPermission(session, "team_management.view");
}

export type TenantSidebarNavItem = {
  key: string;
  href: string;
  label: string;
  icon: MasterFeatureIcon;
  /** Copied from registry — presentation only; not used in visibility checks. */
  moduleCategory?: string;
};

function normalizeHref(href: string): string {
  const path = href.split("?")[0] ?? href;
  if (path.endsWith("/") && path.length > 1) return path.slice(0, -1);
  return path;
}

export type MasterFeatureVisibilityExplain = {
  visible: boolean;
  reason?: string;
};

/**
 * Why a sidebar module is shown or hidden (mirrors {@link isMasterFeatureVisibleForSession} checks in order).
 * For observability tooling — update when sidebar rules change.
 */
export function explainMasterFeatureVisibility(
  session: PulseAuthSession | null,
  feature: MasterFeatureDef,
  isSystemAdmin: boolean,
): MasterFeatureVisibilityExplain {
  if (!feature.navVisible) {
    return { visible: false, reason: "Registry: navVisible is false for this route." };
  }
  if (feature.key === "settings") {
    return session ? { visible: true } : { visible: false, reason: "No session — Settings is gated on an authenticated tenant session." };
  }
  if (feature.key === "team_management") {
    if (isSystemAdmin) return { visible: true };
    if (!session) return { visible: false, reason: "No session." };
    if (session.workers_roster_access === true) return { visible: true };
    if (isTenantFullAdminSession(session)) return { visible: true };
    const fe = isUserFeatureEnabled(session, "team_management");
    const rbacOk = hasRbacPermission(session, "team_management.view");
    if (fe && rbacOk) return { visible: true };
    if (!fe && !rbacOk) {
      return {
        visible: false,
        reason:
          "Team Management needs roster delegate / tenant admin, or both `team_management` in enabled_features and `team_management.view` in rbac_permissions.",
      };
    }
    if (!fe) {
      return { visible: false, reason: "`team_management` is not enabled for this session (feature gate)." };
    }
    return { visible: false, reason: "Missing RBAC key `team_management.view`." };
  }
  if (!session) {
    return { visible: false, reason: "No session." };
  }
  if (session.is_system_admin || session.role === "system_admin") {
    return { visible: true };
  }
  if (!isTenantFeatureOnContract(session, feature.feature)) {
    return {
      visible: false,
      reason: `Module "${feature.feature}" is not licensed on the tenant contract for this session (contract_features).`,
    };
  }
  if (isTenantFullAdminSession(session)) {
    return { visible: true };
  }
  const snap = readAccessSnapshot(session);
  const featureOk = snap ? snapshotHasFeature(snap, feature.feature) : isUserFeatureEnabled(session, feature.feature);
  if (!featureOk) {
    return {
      visible: false,
      reason: snap
        ? `access_snapshot.features does not include ${feature.feature}.`
        : `effective enabled_features does not include ${feature.feature} (canonical/legacy normalization may apply).`,
    };
  }
  if (!feature.rbacAnyOf.length) return { visible: true };
  const ok = feature.rbacAnyOf.some((k) => hasRbacPermission(session, k));
  return ok
    ? { visible: true }
    : {
        visible: false,
        reason: `Missing RBAC: need any of ${feature.rbacAnyOf.join(", ")}.`,
      };
}

export function isMasterFeatureVisibleForSession(
  session: PulseAuthSession | null,
  feature: MasterFeatureDef,
  isSystemAdmin: boolean,
): boolean {
  // Authorization only — `feature.moduleCategory` is never consulted here.
  if (!feature.navVisible) return false;
  if (feature.key === "settings") return Boolean(session);
  if (feature.key === "team_management") {
    return canShowTeamManagement(session, isSystemAdmin);
  }
  if (!session) return false;
  if (session.is_system_admin || session.role === "system_admin") return true;
  if (!isTenantFeatureOnContract(session, feature.feature)) return false;
  if (isTenantFullAdminSession(session)) return true;
  const snap = readAccessSnapshot(session);
  const featureOk = snap ? snapshotHasFeature(snap, feature.feature) : isUserFeatureEnabled(session, feature.feature);
  if (!featureOk) return false;
  if (!feature.rbacAnyOf.length) return true;
  return feature.rbacAnyOf.some((k) => hasRbacPermission(session, k));
}

/**
 * Deduplicated tenant left rail: one entry per `route` and per `feature` contract key.
 */
export function tenantSidebarNavItemsForSession(
  session: PulseAuthSession | null,
): TenantSidebarNavItem[] {
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const seenRoute = new Set<string>();
  const seenFeature = new Set<string>();
  const out: TenantSidebarNavItem[] = [];

  const sorted = [...NAV_VISIBLE_MASTER_FEATURES].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const f of sorted) {
    if (!isMasterFeatureVisibleForSession(session, f, isSystemAdmin)) continue;
    const href = normalizeHref(f.route);
    if (seenRoute.has(href) || seenFeature.has(f.feature)) continue;
    seenRoute.add(href);
    seenFeature.add(f.feature);
    out.push({
      key: f.key,
      href: f.route,
      label: f.label,
      icon: f.icon,
      moduleCategory: normalizeModuleCategory(f.moduleCategory),
    });
  }
  return out;
}

/** @deprecated Department hubs use the same unified sidebar. */
export function departmentHubNavItemsForSession(
  _departmentSlug: string,
  session: PulseAuthSession | null,
): TenantSidebarNavItem[] {
  return tenantSidebarNavItemsForSession(session);
}

export function getTenantNavModuleByPlatformRoute(
  departmentSlug: string,
  routeSeg: string,
): MasterFeatureDef | undefined {
  return MASTER_FEATURES.find(
    (f) => f.platformDepartmentSlug === departmentSlug && f.platformRoute === routeSeg,
  );
}
