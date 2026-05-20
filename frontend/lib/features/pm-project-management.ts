/**
 * Project Management nav + routes — tenant matrix keys and legacy flyout aliases.
 * User-level gate: `session.can_use_pm_features` (System → Users PM toggle).
 */
import { isUserFeatureEnabled } from "@/lib/features/tenant-features";
import type { PulseAuthSession } from "@/lib/pulse-session";

const PM_LEGACY_MATRIX_KEYS = ["pm_workspace", "pm_planning"] as const;

/** Tenant/role matrix enabled for the combined Project Management page. */
export function isProjectManagementFeatureEnabled(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  if (isUserFeatureEnabled(session, "project_management")) return true;
  for (const key of PM_LEGACY_MATRIX_KEYS) {
    if (isUserFeatureEnabled(session, key)) return true;
  }
  return false;
}

export function sessionHasPmToolsPermission(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  const rbac = session.rbac_permissions;
  if (!rbac?.length) return false;
  return rbac.includes("*") || rbac.includes("projects.pm.view");
}

/** Sys-admin PM toggle + matrix + RBAC for Project Management surfaces. */
export function canAccessProjectManagement(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  if (session.is_system_admin || session.role === "system_admin") return true;
  if (!Boolean(session.can_use_pm_features)) return false;
  if (!isProjectManagementFeatureEnabled(session)) return false;
  if (
    session.facility_tenant_admin === true ||
    session.role === "company_admin" ||
    Boolean(session.roles?.includes("company_admin"))
  ) {
    return true;
  }
  return sessionHasPmToolsPermission(session);
}
