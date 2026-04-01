/** Match browser route to Pulse nav href (incl. hash links to /pulse#…). */
export function isPulseNavActive(href: string, pathname: string): boolean {
  if (href.includes("#")) {
    const [path] = href.split("#");
    return pathname === path;
  }
  if (href === "/overview") return pathname === "/overview";
  if (href === "/dashboard/compliance") return pathname === "/dashboard/compliance";
  if (href.startsWith("/dashboard")) return pathname === href || pathname.startsWith(`${href}/`);
  if (href === "/schedule") return pathname === "/schedule" || pathname.startsWith("/schedule/");
  if (href === "/system") return pathname === "/system" || pathname.startsWith("/system/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
