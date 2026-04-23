/**
 * Maps tenant sidebar routes to coarse RBAC keys from `GET /auth/me` → `permissions`.
 * Aligns with `backend/app/core/permissions/keys.py`. `null` = no permission gate (feature flags still apply).
 */

export function permissionRequiredForTenantNavHref(href: string): string | null {
  if (href === "/overview") return null;
  if (href === "/dashboard/compliance" || href.startsWith("/dashboard/compliance")) {
    return "module.maintenance.read";
  }
  if (href === "/schedule") return "module.jobs.read";
  if (href === "/monitoring") return "module.notifications.read";
  if (href === "/projects" || href.startsWith("/projects/")) return "module.analytics.read";
  if (href === "/dashboard/maintenance" || href.startsWith("/dashboard/maintenance")) {
    return "module.maintenance.read";
  }
  if (href === "/dashboard/procedures" || href.startsWith("/dashboard/procedures")) {
    return "module.maintenance.read";
  }
  if (href === "/dashboard/team-insights" || href.startsWith("/dashboard/team-insights")) {
    return "module.jobs.read";
  }
  if (href === "/dashboard/break-room" || href.startsWith("/dashboard/break-room")) {
    return "module.jobs.read";
  }
  if (href === "/dashboard/workers" || href.startsWith("/dashboard/workers")) return "module.jobs.read";
  if (href === "/dashboard/inventory") return "module.inventory.read";
  if (href === "/equipment" || href.includes("tool-tracking")) return "module.tool_tracking.read";
  if (href === "/zones-devices" || href.startsWith("/zones-devices/")) return "module.maintenance.read";
  if (href === "/dashboard/setup") return "module.maintenance.read";
  if (href === "/devices" || href.startsWith("/devices")) return "module.maintenance.read";
  if (href === "/zones" || href.startsWith("/zones")) return "module.maintenance.read";
  return null;
}

/** When `permissions` is missing (legacy session), all gated routes are shown if the feature flag allows. */
export function isTenantNavPermissionGranted(
  href: string,
  permissions: string[] | undefined | null,
): boolean {
  const need = permissionRequiredForTenantNavHref(href);
  if (need === null) return true;
  if (permissions === undefined || permissions === null) return true;
  if (permissions.includes("*")) return true;
  return permissions.includes(need);
}
