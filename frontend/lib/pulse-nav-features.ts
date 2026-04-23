/**
 * Maps tenant sidebar `href` entries to system-admin `company_features` keys.
 * Omitted hrefs are always shown. When `enabled_features` is absent on the session (legacy), all items show.
 */

/** Nav href → feature key required to show the item. */
export function featureKeyForTenantNavHref(href: string): string | undefined {
  if (href === "/dashboard/compliance") return "compliance";
  if (href === "/schedule") return "schedule";
  if (href === "/monitoring") return "monitoring";
  if (href === "/projects" || href.startsWith("/projects/")) return "projects";
  if (href === "/dashboard/work-requests" || href.startsWith("/dashboard/work-requests")) return "work_orders";
  if (href === "/dashboard/maintenance" || href.startsWith("/dashboard/maintenance/")) return "work_orders";
  if (href === "/dashboard/procedures" || href.startsWith("/dashboard/procedures/")) return "work_orders";
  if (href === "/dashboard/team-insights" || href.startsWith("/dashboard/team-insights/")) return "workers";
  if (href === "/dashboard/break-room" || href.startsWith("/dashboard/break-room/")) return "workers";
  if (href === "/dashboard/workers" || href.startsWith("/dashboard/workers")) return "workers";
  if (href === "/dashboard/inventory") return "inventory";
  if (href === "/equipment") return "equipment";
  if (href.includes("tool-tracking")) return "equipment";
  if (href === "/zones-devices" || href.startsWith("/zones-devices/")) return "floor_plan";
  if (href === "/devices" || href.startsWith("/devices")) return "floor_plan";
  if (href === "/zones" || href.startsWith("/zones")) return "floor_plan";
  return undefined;
}

/** True if the nav item should render for this tenant session. */
export function isTenantNavFeatureEnabled(
  href: string,
  enabledFeatures: string[] | undefined | null,
): boolean {
  const key = featureKeyForTenantNavHref(href);
  if (!key) return true;
  if (enabledFeatures === undefined || enabledFeatures === null) return true;
  if (key === "equipment") {
    return (
      enabledFeatures.includes("equipment") ||
      enabledFeatures.includes("tool_tracking") ||
      enabledFeatures.includes("rtls_tracking")
    );
  }
  return enabledFeatures.includes(key);
}
