/**
 * Centralized tenant authorization from `/auth/me`:
 * `contract_features` (or `contract_enabled_features` for company admins) + `rbac_permissions`.
 * Sidebar/module visibility uses `enabled_features` (matrix-derived, plus overlays) via `isUserFeatureEnabled`.
 */
import { PLATFORM_DEPARTMENTS, PLATFORM_DEPARTMENT_SLUGS } from "@/config/platform/departments";
import type { PulseAuthSession } from "@/lib/pulse-session";
import {
  getLegacyPlatformRouteAlias,
  LEGACY_PLATFORM_ROUTE_ALIASES,
} from "@/config/platform/legacy-platform-routes";
import { getMasterFeatureForPath, MASTER_FEATURES } from "@/config/platform/master-feature-registry";
import { isTenantFeatureOnContract, isUserFeatureEnabled } from "@/lib/features/tenant-features";
import { readAccessSnapshot, snapshotHasCapability } from "@/lib/access-snapshot";
import { groupModulesByCategory, type TenantSidebarNavGroup } from "@/lib/rbac/sidebar-groups";
import { tenantSidebarNavItemsForSession } from "@/lib/rbac/tenant-nav";
import { sessionHasAnyRole } from "@/lib/pulse-roles";

type NavGate =
  | { kind: "deny" }
  /** Signed-in account / legal shell only (no product entitlement). */
  | { kind: "authenticated_shell" }
  /** Session JWT roles only — use sparingly; must match server-side page guards. */
  | { kind: "session_roles_any"; roles: readonly string[] }
  | {
      kind: "module";
      companyModules: readonly string[];
      rbacAnyOf: readonly string[];
      /** When true, every module in `companyModules` must be on the contract (default: any). */
      requireAllContractModules?: boolean;
      /** When set, user must have every permission listed (takes precedence over `rbacAnyOf`). */
      rbacAllOf?: readonly string[];
    };

function normalizeHref(href: string): string {
  const path = href.split("?")[0] ?? href;
  if (path.endsWith("/") && path.length > 1) return path.slice(0, -1);
  return path;
}

/** Company contract / SysAdmin module keys available to this session. */
export function tenantContractModuleSet(session: PulseAuthSession | null): Set<string> {
  const raw = session?.contract_features?.length
    ? session.contract_features
    : session?.contract_enabled_features ?? [];
  return new Set(raw);
}

export function tenantHasAnyCompanyModule(session: PulseAuthSession | null, modules: readonly string[]): boolean {
  return modules.some((m) => isTenantFeatureOnContract(session, m));
}

export function tenantHasEveryCompanyModule(session: PulseAuthSession | null, modules: readonly string[]): boolean {
  return modules.length > 0 && modules.every((m) => isTenantFeatureOnContract(session, m));
}

/** Flat RBAC keys from canonical snapshot (`*` = unrestricted within tenant). */
export function hasRbacPermission(session: PulseAuthSession | null, permissionKey: string): boolean {
  const snap = readAccessSnapshot(session);
  if (snap) return snapshotHasCapability(snap, permissionKey);
  const rbac = session?.rbac_permissions;
  if (!rbac?.length) return false;
  return rbac.includes("*") || rbac.includes(permissionKey);
}

/** Central permission check for UI — use instead of workspace or department-slug branching. */
export function can(session: PulseAuthSession | null, permissionKey: string): boolean {
  return hasRbacPermission(session, permissionKey);
}

export function isTenantFullAdminSession(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  return (
    session.facility_tenant_admin === true ||
    session.role === "company_admin" ||
    Boolean(session.roles?.includes("company_admin"))
  );
}

function classicNavGate(href: string): NavGate {
  const h = normalizeHref(href);
  for (const slug of PLATFORM_DEPARTMENT_SLUGS) {
    if (h !== `/${slug}` && !h.startsWith(`/${slug}/`)) continue;
    if (h === `/${slug}`) return { kind: "deny" };
    const routeSeg = h.slice(slug.length + 2).split("/").filter(Boolean)[0] ?? "";
    if (!routeSeg) return { kind: "deny" };
    const legacy = getLegacyPlatformRouteAlias(slug, routeSeg);
    const master = MASTER_FEATURES.find(
      (f) => f.platformDepartmentSlug === slug && f.platformRoute === routeSeg,
    );
    const feature = legacy?.feature ?? master?.feature;
    const rbac = legacy?.rbacAnyOf ?? master?.rbacAnyOf;
    if (!feature || !rbac) return { kind: "deny" };
    return { kind: "module", companyModules: [feature], rbacAnyOf: [...rbac] };
  }
  if (h === "/overview/project" || h.startsWith("/overview/project/")) {
    return {
      kind: "module",
      companyModules: ["dashboard", "projects"],
      rbacAnyOf: [],
      requireAllContractModules: true,
      rbacAllOf: ["dashboard.view", "projects.view"],
    };
  }
  if (h === "/overview" || h.startsWith("/overview/")) {
    return { kind: "module", companyModules: ["dashboard"], rbacAnyOf: ["dashboard.view"] };
  }

  if (h === "/worker" || h.startsWith("/worker/")) {
    return { kind: "module", companyModules: ["dashboard"], rbacAnyOf: ["dashboard.view"] };
  }
  if (h === "/dashboard/organization" || h.startsWith("/dashboard/organization/")) {
    return { kind: "session_roles_any", roles: ["company_admin"] };
  }
  if (h === "/settings" || h.startsWith("/settings/")) return { kind: "authenticated_shell" };
  if (h === "/dashboard/profile-settings" || h.startsWith("/dashboard/profile-settings/")) {
    return { kind: "authenticated_shell" };
  }
  if (h === "/operations" || h.startsWith("/operations/")) {
    return { kind: "module", companyModules: ["monitoring"], rbacAnyOf: ["monitoring.view"] };
  }
  if (h.includes("tool-tracking")) {
    return {
      kind: "module",
      companyModules: ["equipment", "tool_tracking", "rtls_tracking"],
      rbacAnyOf: ["equipment.view"],
    };
  }

  const master = getMasterFeatureForPath(h);
  if (master) {
    if (master.key === "equipment") {
      return {
        kind: "module",
        companyModules: ["equipment", "tool_tracking", "rtls_tracking"],
        rbacAnyOf: [...master.rbacAnyOf],
      };
    }
    return {
      kind: "module",
      companyModules: [master.feature],
      rbacAnyOf: [...master.rbacAnyOf],
    };
  }

  return { kind: "deny" };
}

/**
 * Classic tenant left-rail / product entry: contract module(s) ∩ RBAC (any of `rbacAnyOf`).
 * System admin shell is handled separately in `AppSideNav`.
 */
export function canAccessClassicNavHref(session: PulseAuthSession | null, href: string): boolean {
  if (!session) return false;
  if (session.is_system_admin === true || session.role === "system_admin") return true;

  const h = normalizeHref(href);
  if ((h === "/overview" || h.startsWith("/overview/")) && isTenantFullAdminSession(session)) {
    return true;
  }
  if (h === "/admin") {
    return isTenantFullAdminSession(session);
  }

  const gate = classicNavGate(href);
  if (gate.kind === "deny") return false;
  if (gate.kind === "authenticated_shell") return true;
  if (gate.kind === "session_roles_any") return sessionHasAnyRole(session, ...gate.roles);
  const master = getMasterFeatureForPath(h);
  if (master && !isUserFeatureEnabled(session, master.feature)) return false;

  const modsOk = gate.requireAllContractModules
    ? tenantHasEveryCompanyModule(session, gate.companyModules)
    : tenantHasAnyCompanyModule(session, gate.companyModules);
  if (!modsOk) return false;
  if (gate.rbacAllOf?.length) {
    return gate.rbacAllOf.every((k) => hasRbacPermission(session, k));
  }
  if (!gate.rbacAnyOf.length) return true;
  return gate.rbacAnyOf.some((k) => hasRbacPermission(session, k));
}

/** Same rules as the tenant left rail row for `href` (includes Team Management delegation). */
export function canShowClassicSidebarItem(
  session: PulseAuthSession | null,
  href: string,
  isSystemAdmin: boolean,
): boolean {
  if (!session) return false;
  if (session.is_system_admin === true || session.role === "system_admin") return true;
  if (isWorkersManagementHref(href)) return canShowTeamManagementNavItem(session, isSystemAdmin);
  return canAccessClassicNavHref(session, href);
}

/** @deprecated Use {@link tenantSidebarNavItemsForSession} — single registry-driven sidebar. */
export function flatPlatformNavSidebarItemsForSession(
  session: PulseAuthSession | null,
): ReturnType<typeof tenantSidebarNavItemsForSession> {
  return tenantSidebarNavItemsForSession(session).filter((row) =>
    MASTER_FEATURES.some((m) => m.key === row.key && Boolean(m.platformRoute)),
  );
}

/**
 * First classic-tenant sidebar destination the user may open (excluding Settings).
 * Used when `/overview` is disabled or there is no workspace hub.
 */
export function firstAccessibleClassicTenantHref(session: PulseAuthSession | null): string {
  if (!session) return "/login";
  const sys = Boolean(session.is_system_admin || session.role === "system_admin");
  if (sys) return "/system";
  if (isTenantFullAdminSession(session) && canAccessClassicNavHref(session, "/overview")) {
    return "/overview";
  }
  for (const row of tenantSidebarNavItemsForLiveApp(session)) {
    if (canShowClassicSidebarItem(session, row.href, sys)) return row.href;
  }
  return "/settings";
}

/** Production sidebar rows: registry visibility ∩ classic route gate (excludes Settings). */
export function tenantSidebarNavItemsForLiveApp(
  session: PulseAuthSession | null,
): ReturnType<typeof tenantSidebarNavItemsForSession> {
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  let items = tenantSidebarNavItemsForSession(session);
  if (!isSystemAdmin && session) {
    items = items.filter((i) => canAccessClassicNavHref(session, i.href));
  }
  return items.filter((i) => i.href !== "/settings");
}

/**
 * Authorized sidebar modules grouped by registry `moduleCategory` (presentation only).
 * Runs after {@link tenantSidebarNavItemsForLiveApp} — no additional access filtering.
 */
export function tenantSidebarNavGroupsForLiveApp(session: PulseAuthSession | null): TenantSidebarNavGroup[] {
  return groupModulesByCategory(tenantSidebarNavItemsForLiveApp(session));
}

export type { TenantSidebarNavGroup };

/** Team Management row: roster delegation, tenant full admin, or contract + RBAC. */
export function canShowTeamManagementNavItem(session: PulseAuthSession | null, isSystemAdmin: boolean): boolean {
  if (!session) return false;
  if (isSystemAdmin) return true;
  if (session.workers_roster_access === true) return true;
  if (isTenantFullAdminSession(session)) return true;
  return tenantHasAnyCompanyModule(session, ["team_management"]) && hasRbacPermission(session, "team_management.view");
}

export function isWorkersManagementHref(href: string): boolean {
  const h = normalizeHref(href);
  return h === "/dashboard/workers" || h.startsWith("/dashboard/workers/");
}
