/**
 * Single source of truth for “marketing site vs Pulse product” URL prefixes.
 * Use this when splitting deploys (www vs pulse) or validating middleware.
 *
 * Important: `/pulse` is the **marketing product story page** (facility map, feature sections).
 * The **signed-in Pulse app** is `/login`, `/overview`, `/dashboard/*`, `/system/*`, etc.
 */

/** Public / brochure routes — safe to serve only on the marketing host. */
export const MARKETING_PATH_PREFIXES = [
  "/", // only exact match in helpers below
  "/pulse",
  "/landing-variants",
] as const;

/**
 * Authenticated (or auth-entry) product routes — intended for the Pulse app host
 * when marketing and product are split across origins.
 */
export const PRODUCT_PATH_PREFIXES = [
  "/login",
  "/invite",
  "/reset-password",
  "/overview",
  "/schedule",
  "/monitoring",
  "/operations",
  "/projects",
  "/equipment",
  "/dashboard",
  "/system",
  "/sop",
  "/zones-devices",
] as const;

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const s = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return s || "/";
}

/** True if pathname belongs to the marketing brochure surface (home, /pulse, landing variants). */
export function isMarketingPath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  if (p === "/") return true;
  return MARKETING_PATH_PREFIXES.some(
    (prefix) => prefix !== "/" && (p === prefix || p.startsWith(`${prefix}/`)),
  );
}

/** True if pathname belongs to the Pulse product (auth + tenant + system admin). */
export function isProductPath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return PRODUCT_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}
