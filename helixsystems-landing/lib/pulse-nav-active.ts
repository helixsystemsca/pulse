/**
 * Returns whether a sidebar `href` should render as active for the current `pathname`.
 * Handles `/pulse#section` hash links, `/schedule` subtree, `/system` subtree, and `/dashboard/*`.
 */
export function isPulseNavActive(href: string, pathname: string): boolean {
  if (href.includes("#")) {
    const [path] = href.split("#");
    return pathname === path;
  }
  if (href === "/overview") return pathname === "/overview";
  if (href === "/dashboard/compliance") return pathname === "/dashboard/compliance";
  if (href === "/dashboard/payments") return pathname === "/dashboard/payments";
  if (href.startsWith("/dashboard")) return pathname === href || pathname.startsWith(`${href}/`);
  if (href === "/schedule") return pathname === "/schedule" || pathname.startsWith("/schedule/");
  if (href === "/system") return pathname === "/system" || pathname.startsWith("/system/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
