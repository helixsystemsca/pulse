export type FeatureHasFn = (key: string) => boolean;

export type DashboardNavItem = {
  href: string;
  label: string;
  show: boolean;
  icon: string;
};

export const ROUTE_TITLES: Record<string, string> = {
  "/admin": "Overview",
  "/work-requests": "Work Requests",
  "/monitoring": "Monitoring",
  "/admin/tools": "Assets",
  "/admin/inventory": "Inventory",
  "/admin/jobs": "Workers",
  "/admin/maintenance": "Maintenance",
  "/admin/zones": "Zones",
  "/admin/alerts": "Alerts",
  "/admin/reports": "Analytics",
  "/admin/settings": "Settings",
};

export function buildDashboardNavItems(loaded: boolean, has: FeatureHasFn): DashboardNavItem[] {
  return [
    { href: "/admin", label: "Overview", show: true, icon: "◇" },
    { href: "/work-requests", label: "Work Requests", show: true, icon: "▸" },
    { href: "/monitoring", label: "Monitoring", show: true, icon: "◈" },
    { href: "/admin/tools", label: "Assets", show: loaded && has("tool_tracking"), icon: "◆" },
    { href: "/admin/inventory", label: "Inventory", show: loaded && has("inventory"), icon: "▤" },
    { href: "/admin/jobs", label: "Workers", show: loaded && has("jobs"), icon: "◎" },
    { href: "/admin/zones", label: "Zones", show: loaded && has("maintenance"), icon: "▢" },
    { href: "/admin/maintenance", label: "Maintenance", show: loaded && has("maintenance"), icon: "◐" },
    { href: "/admin/alerts", label: "Alerts", show: true, icon: "⚑" },
    { href: "/admin/reports", label: "Reports", show: loaded && has("analytics"), icon: "◧" },
    { href: "/admin/settings", label: "Settings", show: true, icon: "⚙" },
  ].filter((n) => n.show);
}

export function dashboardPageTitle(pathname: string): string {
  const path = pathname.replace(/\/$/, "") || "/admin";
  if (path.startsWith("/work-requests")) return ROUTE_TITLES["/work-requests"];
  if (path.startsWith("/monitoring")) return ROUTE_TITLES["/monitoring"];
  if (path in ROUTE_TITLES) return ROUTE_TITLES[path];
  const match = Object.keys(ROUTE_TITLES)
    .filter((k) => k !== "/admin")
    .sort((a, b) => b.length - a.length)
    .find((k) => path === k || path.startsWith(`${k}/`));
  return match ? ROUTE_TITLES[match] : "Dashboard";
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin" || pathname === "/admin/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
