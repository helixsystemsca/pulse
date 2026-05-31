/**
 * Tenant sidebar — master registry → contract → effective `enabled_features` (default deny).
 */
import { normalizeModuleCategory } from "@/config/platform/module-categories";
import type { NavDomain } from "@/config/platform/nav-domains";
import type { DashboardScope } from "@/config/platform/dashboard-scope";
import {
  MASTER_FEATURES,
  NAV_VISIBLE_MASTER_FEATURES,
  normalizeNavHref,
  type MasterFeatureDef,
  type MasterFeatureIcon,
} from "@/config/platform/master-feature-registry";
import { readAccessSnapshot, snapshotHasCapability, snapshotHasFeature } from "@/lib/access-snapshot";
import {
  isProjectManagementFeatureEnabled,
  sessionHasPmToolsPermission,
} from "@/lib/features/pm-project-management";
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

function canShowProjectManagement(session: PulseAuthSession | null, isSystemAdmin: boolean): boolean {
  if (!session) return false;
  if (isSystemAdmin) return true;
  if (!Boolean(session.can_use_pm_features)) return false;
  if (!isTenantFeatureOnContract(session, "projects")) return false;
  if (isTenantFullAdminSession(session)) return true;
  if (!isProjectManagementFeatureEnabled(session)) return false;
  return sessionHasPmToolsPermission(session);
}

function canShowTeamManagement(session: PulseAuthSession | null, isSystemAdmin: boolean): boolean {
  if (!session) return false;
  if (isSystemAdmin) return true;
  if (session.workers_roster_access === true) return true;
  if (isTenantFullAdminSession(session)) return true;
  return isUserFeatureEnabled(session, "team_management") && hasRbacPermission(session, "team_management.view");
}

/** Staff with full Inventory use the header kiosk button; sidebar Scanner is for scan-only accounts. */
function inventoryScannerSidebarHiddenForInventoryStaff(
  session: PulseAuthSession | null,
  isSystemAdmin: boolean,
): boolean {
  if (isSystemAdmin || !session) return false;
  return isUserFeatureEnabled(session, "inventory") && hasRbacPermission(session, "inventory.view");
}

export type TenantSidebarNavItem = {
  key: string;
  href: string;
  label: string;
  icon: MasterFeatureIcon;
  /** Copied from registry — presentation only; not used in visibility checks. */
  moduleCategory?: string;
  /** Workflow domain — presentation only; never used in visibility checks. */
  navDomain?: NavDomain;
  navGroup?: string;
  navOrder?: number;
  dashboardScope?: DashboardScope;
  ownershipDepartment?: string;
};

function normalizeHref(href: string): string {
  return normalizeNavHref(href);
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
  if (feature.key === "project_management") {
    if (isSystemAdmin) return { visible: true };
    if (!session) return { visible: false, reason: "No session." };
    if (!Boolean(session.can_use_pm_features)) {
      return { visible: false, reason: "PM tools are disabled for this user (System → Users toggle)." };
    }
    if (!isTenantFeatureOnContract(session, "projects")) {
      return { visible: false, reason: 'Projects module is not on the tenant contract.' };
    }
    if (isTenantFullAdminSession(session)) return { visible: true };
    if (!isProjectManagementFeatureEnabled(session)) {
      return {
        visible: false,
        reason:
          "Project Management needs `project_management` or legacy `pm_workspace` / `pm_planning` in enabled_features.",
      };
    }
    if (!sessionHasPmToolsPermission(session)) {
      return { visible: false, reason: "Missing RBAC key `projects.pm.view`." };
    }
    return { visible: true };
  }
  if (feature.key === "team_management" || feature.key === "permissions") {
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
          "Permissions needs roster delegate / tenant admin, or both `team_management` in enabled_features and `team_management.view` in rbac_permissions.",
      };
    }
    if (!fe) {
      return { visible: false, reason: "`team_management` is not enabled for this session (feature gate)." };
    }
    return { visible: false, reason: "Missing RBAC key `team_management.view`." };
  }
  if (feature.key === "inventory_scanner") {
    if (inventoryScannerSidebarHiddenForInventoryStaff(session, isSystemAdmin)) {
      return {
        visible: false,
        reason: "Inventory staff open the scanner from the Inventory page header (Scanner kiosk).",
      };
    }
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
  if (!passesOwnershipDepartmentGate(session, feature)) {
    return {
      visible: false,
      reason: `Module is owned by "${feature.ownershipDepartment}"; session hr_department does not match.`,
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

/** Maintenance-owned analytics — not shown to other departments even when the feature is enabled. */
const HR_DEPARTMENT_OWNERSHIP_KEYS = new Set(["team_insights", "workforce_insights"]);

function passesOwnershipDepartmentGate(
  session: PulseAuthSession,
  feature: MasterFeatureDef,
): boolean {
  if (!HR_DEPARTMENT_OWNERSHIP_KEYS.has(feature.key)) return true;
  const owner = feature.ownershipDepartment?.trim().toLowerCase();
  if (!owner) return true;
  if (isTenantFullAdminSession(session)) return true;
  const userDept = (session.hr_department ?? "").trim().toLowerCase();
  return userDept === owner;
}

export function isMasterFeatureVisibleForSession(
  session: PulseAuthSession | null,
  feature: MasterFeatureDef,
  isSystemAdmin: boolean,
): boolean {
  // Authorization only — `feature.moduleCategory` is never consulted here.
  if (!feature.navVisible) return false;
  if (feature.key === "settings") return Boolean(session);
  if (feature.key === "project_management") {
    return canShowProjectManagement(session, isSystemAdmin);
  }
  if (feature.key === "team_management" || feature.key === "permissions") {
    return canShowTeamManagement(session, isSystemAdmin);
  }
  if (feature.key === "inventory_scanner" && inventoryScannerSidebarHiddenForInventoryStaff(session, isSystemAdmin)) {
    return false;
  }
  if (!session) return false;
  if (session.is_system_admin || session.role === "system_admin") return true;
  if (!isTenantFeatureOnContract(session, feature.feature)) return false;
  if (isTenantFullAdminSession(session)) return true;
  const snap = readAccessSnapshot(session);
  const featureOk = snap ? snapshotHasFeature(snap, feature.feature) : isUserFeatureEnabled(session, feature.feature);
  if (!featureOk) return false;
  if (!passesOwnershipDepartmentGate(session, feature)) return false;
  if (!feature.rbacAnyOf.length) return true;
  return feature.rbacAnyOf.some((k) => hasRbacPermission(session, k));
}

/**
 * Deduplicated tenant left rail: one entry per canonical `route` (query-aware).
 * Multiple rows may share a permission-matrix `feature` key (navigation aliases).
 */
export function tenantSidebarNavItemsForSession(
  session: PulseAuthSession | null,
): TenantSidebarNavItem[] {
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const seenNavSlot = new Set<string>();
  const out: TenantSidebarNavItem[] = [];

  const sorted = [...NAV_VISIBLE_MASTER_FEATURES].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const f of sorted) {
    if (!isMasterFeatureVisibleForSession(session, f, isSystemAdmin)) continue;
    const href = normalizeHref(f.route);
    const slot = `${href}|${f.navDomain}`;
    if (seenNavSlot.has(slot)) continue;
    seenNavSlot.add(slot);
    out.push({
      key: f.key,
      href: f.route,
      label: f.navLabelOverride?.trim() || f.label,
      icon: f.icon,
      moduleCategory: normalizeModuleCategory(f.moduleCategory),
      navDomain: f.navDomain,
      navGroup: f.navGroup,
      navOrder: f.navOrder ?? f.sortOrder,
      dashboardScope: f.dashboardScope,
      ownershipDepartment: f.ownershipDepartment,
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
