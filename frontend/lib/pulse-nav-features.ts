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
  if (href === "/dashboard/pm-workspace" || href.startsWith("/dashboard/pm-workspace")) return "projects";
  if (href === "/pm/planning" || href.startsWith("/pm/")) return "projects";
  if (href === "/dashboard/work-requests" || href.startsWith("/dashboard/work-requests")) return "work_requests";
  if (href === "/dashboard/maintenance" || href.startsWith("/dashboard/maintenance")) return "work_requests";
  if (href === "/standards" || href.startsWith("/standards")) return "procedures";
  if (href === "/dashboard/procedures" || href.startsWith("/dashboard/procedures")) return "procedures";
  if (href === "/dashboard/team-insights" || href.startsWith("/dashboard/team-insights")) return "team_insights";
  if (href === "/dashboard/workers" || href.startsWith("/dashboard/workers")) return "team_management";
  if (href === "/dashboard/inventory") return "inventory";
  if (href === "/equipment") return "equipment";
  if (href.includes("tool-tracking")) return "equipment";
  if (href === "/drawings" || href.startsWith("/drawings")) return "drawings";
  if (href === "/zones-devices" || href.startsWith("/zones-devices")) return "zones_devices";
  if (href === "/devices" || href.startsWith("/devices")) return "zones_devices";
  if (href === "/zones" || href.startsWith("/zones")) return "zones_devices";
  if (href === "/live-map" || href.startsWith("/live-map")) return "live_map";
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
