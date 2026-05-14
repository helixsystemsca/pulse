/**
 * Centralized tenant authorization from `/auth/me`:
 * `contract_features` (or `contract_enabled_features` for company admins) + `rbac_permissions`.
 * No `enabled_features` or coarse `permissions` branching for visibility.
 */
import { PLATFORM_DEPARTMENT_SLUGS } from "@/config/platform/departments";
import type { PulseAuthSession } from "@/lib/pulse-session";

type NavGate =
  | { kind: "always" }
  | { kind: "module"; companyModules: readonly string[]; rbacAnyOf: readonly string[] };

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
  const s = tenantContractModuleSet(session);
  return modules.some((m) => s.has(m));
}

/** Flat RBAC keys from `/auth/me` (`*` = unrestricted within tenant). */
export function hasRbacPermission(session: PulseAuthSession | null, permissionKey: string): boolean {
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

function classicNavGate(href: string): NavGate {
  const h = normalizeHref(href);
  for (const slug of PLATFORM_DEPARTMENT_SLUGS) {
    if (h === `/${slug}` || h.startsWith(`/${slug}/`)) return { kind: "always" };
  }
  if (h === "/overview") return { kind: "always" };

  if (h === "/dashboard/messages" || h.startsWith("/dashboard/messages")) {
    return { kind: "module", companyModules: ["messaging"], rbacAnyOf: ["messaging.view"] };
  }
  if (h === "/dashboard/compliance" || h.startsWith("/dashboard/compliance")) {
    return { kind: "module", companyModules: ["compliance"], rbacAnyOf: ["compliance.view"] };
  }
  if (h === "/schedule") return { kind: "module", companyModules: ["schedule"], rbacAnyOf: ["schedule.view"] };
  if (h === "/monitoring") return { kind: "module", companyModules: ["monitoring"], rbacAnyOf: ["monitoring.view"] };
  if (h === "/projects" || h.startsWith("/projects/")) {
    return { kind: "module", companyModules: ["projects"], rbacAnyOf: ["projects.view"] };
  }
  if (h === "/dashboard/pm-workspace" || h.startsWith("/dashboard/pm-workspace")) {
    return { kind: "module", companyModules: ["projects"], rbacAnyOf: ["projects.view"] };
  }
  if (h === "/pm/planning" || h.startsWith("/pm/")) {
    return { kind: "module", companyModules: ["projects"], rbacAnyOf: ["projects.view"] };
  }
  if (h === "/dashboard/work-requests" || h.startsWith("/dashboard/work-requests")) {
    return {
      kind: "module",
      companyModules: ["work_requests"],
      rbacAnyOf: ["work_requests.view", "work_requests.edit"],
    };
  }
  if (h === "/dashboard/maintenance" || h.startsWith("/dashboard/maintenance")) {
    return {
      kind: "module",
      companyModules: ["work_requests"],
      rbacAnyOf: ["work_requests.view", "work_requests.edit"],
    };
  }
  if (h === "/standards" || h.startsWith("/standards")) {
    return { kind: "module", companyModules: ["procedures"], rbacAnyOf: ["procedures.view"] };
  }
  if (h === "/dashboard/procedures" || h.startsWith("/dashboard/procedures")) {
    return { kind: "module", companyModules: ["procedures"], rbacAnyOf: ["procedures.view"] };
  }
  if (h === "/dashboard/team-insights" || h.startsWith("/dashboard/team-insights")) {
    return { kind: "module", companyModules: ["team_insights"], rbacAnyOf: ["team_insights.view"] };
  }
  if (h === "/dashboard/workers" || h.startsWith("/dashboard/workers")) {
    return { kind: "module", companyModules: ["team_management"], rbacAnyOf: ["team_management.view"] };
  }
  if (h === "/dashboard/inventory") return { kind: "module", companyModules: ["inventory"], rbacAnyOf: ["inventory.view", "inventory.manage"] };
  if (h === "/equipment" || h.includes("tool-tracking")) {
    return {
      kind: "module",
      companyModules: ["equipment", "tool_tracking", "rtls_tracking"],
      rbacAnyOf: ["equipment.view"],
    };
  }
  if (h === "/drawings" || h.startsWith("/drawings")) {
    return { kind: "module", companyModules: ["drawings"], rbacAnyOf: ["drawings.view"] };
  }
  if (h === "/zones-devices" || h.startsWith("/zones-devices")) {
    return { kind: "module", companyModules: ["zones_devices"], rbacAnyOf: ["zones_devices.view"] };
  }
  if (h === "/devices" || h.startsWith("/devices")) {
    return { kind: "module", companyModules: ["zones_devices"], rbacAnyOf: ["zones_devices.view"] };
  }
  if (h === "/zones" || h.startsWith("/zones")) {
    return { kind: "module", companyModules: ["zones_devices"], rbacAnyOf: ["zones_devices.view"] };
  }
  if (h === "/live-map" || h.startsWith("/live-map")) {
    return { kind: "module", companyModules: ["live_map"], rbacAnyOf: ["live_map.view"] };
  }
  if (h === "/settings" || h.startsWith("/settings")) return { kind: "always" };

  return { kind: "always" };
}

/**
 * Classic tenant left-rail / product entry: contract module(s) ∩ RBAC (any of `rbacAnyOf`).
 * System admin shell is handled separately in `AppSideNav`.
 */
export function canAccessClassicNavHref(session: PulseAuthSession | null, href: string): boolean {
  if (!session) return false;
  if (session.is_system_admin === true || session.role === "system_admin") return true;

  const gate = classicNavGate(href);
  if (gate.kind === "always") return true;

  if (!tenantHasAnyCompanyModule(session, gate.companyModules)) return false;
  if (!gate.rbacAnyOf.length) return true;
  return gate.rbacAnyOf.some((k) => hasRbacPermission(session, k));
}

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
