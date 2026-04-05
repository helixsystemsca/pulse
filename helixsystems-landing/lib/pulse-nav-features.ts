/**
 * Maps tenant sidebar `href` entries to system-admin `company_features` keys.
 * Omitted hrefs are always shown. When `enabled_features` is absent on the session (legacy), all items show.
 */

const PROJECTS_FEATURE = "projects";

/** Nav href → feature key required to show the item. */
export function featureKeyForTenantNavHref(href: string): string | undefined {
  if (href === "/dashboard/compliance") return "compliance";
  if (href === "/schedule") return "schedule";
  if (href === "/monitoring" || href === "/projects" || href.startsWith("/projects/")) return PROJECTS_FEATURE;
  if (href === "/dashboard/inventory") return "inventory";
  if (href === "/equipment") return "equipment";
  if (href.includes("tool-tracking")) return "equipment";
  if (href.startsWith("/zones-devices")) return "maintenance";
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
    return enabledFeatures.includes("equipment") || enabledFeatures.includes("tool_tracking");
  }
  return enabledFeatures.includes(key);
}
