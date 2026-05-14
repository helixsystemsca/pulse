/**
 * Legacy href → company feature key (SysAdmin catalog). Used for admin UIs only — not tenant authorization.
 * Tenant visibility uses {@link canAccessClassicNavHref} in `@/lib/rbac/session-access`.
 */

import { PLATFORM_DEPARTMENT_SLUGS } from "@/config/platform/departments";

/** Nav href → feature key (company contract / system catalog). */
export function featureKeyForTenantNavHref(href: string): string | undefined {
  for (const slug of PLATFORM_DEPARTMENT_SLUGS) {
    if (href === `/${slug}` || href.startsWith(`/${slug}/`)) return undefined;
  }
  if (href === "/overview" || href.startsWith("/overview/")) return "dashboard";
  if (href === "/dashboard/messages" || href.startsWith("/dashboard/messages")) return "messaging";
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
