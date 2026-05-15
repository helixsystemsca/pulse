/**
 * Tenant sidebar — master registry → contract → effective `enabled_features` (default deny).
 */
import {
  MASTER_FEATURES,
  NAV_VISIBLE_MASTER_FEATURES,
  type MasterFeatureDef,
  type MasterFeatureIcon,
} from "@/config/platform/master-feature-registry";
import { isTenantFeatureOnContract, isUserFeatureEnabled } from "@/lib/features/tenant-features";
import type { PulseAuthSession } from "@/lib/pulse-session";

function hasRbacPermission(session: PulseAuthSession | null, permissionKey: string): boolean {
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
};

function normalizeHref(href: string): string {
  const path = href.split("?")[0] ?? href;
  if (path.endsWith("/") && path.length > 1) return path.slice(0, -1);
  return path;
}

export function isMasterFeatureVisibleForSession(
  session: PulseAuthSession | null,
  feature: MasterFeatureDef,
  isSystemAdmin: boolean,
): boolean {
  if (!feature.navVisible) return false;
  if (feature.key === "settings") return Boolean(session);
  if (feature.key === "team_management") {
    return canShowTeamManagement(session, isSystemAdmin);
  }
  if (!session) return false;
  if (session.is_system_admin || session.role === "system_admin") return true;
  if (!isTenantFeatureOnContract(session, feature.feature)) return false;
  if (isTenantFullAdminSession(session)) return true;
  if (!isUserFeatureEnabled(session, feature.feature)) return false;
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
