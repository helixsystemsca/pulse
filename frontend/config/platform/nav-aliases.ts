/**
 * Route aliases — safe redirects preserving bookmarks (presentation / routing only).
 */
export const NAV_ROUTE_ALIASES: Readonly<Record<string, string>> = {
  "/dashboard/procedures": "/training/learning/procedures",
  "/dashboard/work-requests": "/dashboard/maintenance",
  "/dashboard/maintenance/work-requests": "/dashboard/maintenance",
  "/dashboard/maintenance/work-orders": "/dashboard/maintenance",
  "/dashboard/maintenance/inspections": "/dashboard/compliance",
  "/dashboard/maintenance/analytics": "/team-management/insights",
  "/dashboard/maintenance/messaging": "/dashboard/messages",
  "/dashboard/maintenance/preventative": "/dashboard/maintenance",
  "/operations": "/monitoring",
  "/admin": "/overview",
  "/dashboard/purchasing": "/dashboard/inventory",
};

export function resolveNavRouteAlias(pathname: string): string {
  const path = pathname.split("?")[0] ?? pathname;
  const normalized = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  return NAV_ROUTE_ALIASES[normalized] ?? pathname;
}
