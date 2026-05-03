/**
 * Returns whether a sidebar `href` should render as active for the current `pathname`.
 * Handles `/pulse#section` hash links, `/schedule` subtree, `/system` subtree, and `/dashboard/*`.
 */
export function isPulseNavActive(href: string, pathname: string): boolean {
  if (href.includes("#")) {
    const [path] = href.split("#");
    return pathname === path;
  }
  if (href === "/overview")
    return (
      pathname === "/overview" ||
      pathname.startsWith("/overview/project") ||
      pathname === "/worker" ||
      pathname.startsWith("/worker/")
    );
  if (href === "/dashboard/compliance") return pathname === "/dashboard/compliance";
  if (href === "/dashboard/maintenance")
    return pathname === "/dashboard/maintenance" || pathname.startsWith("/dashboard/maintenance/");
  if (href === "/dashboard/procedures")
    return pathname === "/dashboard/procedures" || pathname.startsWith("/dashboard/procedures/");
  if (href === "/dashboard/team-insights")
    return pathname === "/dashboard/team-insights" || pathname.startsWith("/dashboard/team-insights/");
  if (href === "/dashboard/workers") return pathname === "/dashboard/workers";
  if (href === "/dashboard/inventory") return pathname === "/dashboard/inventory";
  if (href === "/pm/planning") return pathname === "/pm/planning" || pathname.startsWith("/pm/planning/");
  if (href.startsWith("/dashboard")) return pathname === href || pathname.startsWith(`${href}/`);
  if (href === "/schedule") return pathname === "/schedule" || pathname.startsWith("/schedule/");
  if (href === "/monitoring")
    return (
      pathname === "/monitoring" ||
      pathname.startsWith("/monitoring/") ||
      pathname === "/operations" ||
      pathname.startsWith("/operations/")
    );
  if (href === "/equipment") return pathname === "/equipment" || pathname.startsWith("/equipment/");
  if (href === "/zones-devices/zones") return pathname.startsWith("/zones-devices");
  if (href === "/projects") return pathname === "/projects" || pathname.startsWith("/projects/");
  if (href === "/system") return pathname === "/system" || pathname.startsWith("/system/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
