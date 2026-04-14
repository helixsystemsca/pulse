/**
 * Pulse product routing helpers: absolute URLs for the app host, post-login paths,
 * left-rail (`pulseTenantSidebarNav` / `pulseSystemSidebarNav`) and top-nav definitions,
 * and marketing-site links. Marketing vs Pulse app hosts are intentionally split.
 *
 * Default app origin: `pulse.helixsystems.ca`. Override with `NEXT_PUBLIC_PULSE_APP_URL`.
 */
function pulseAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_PULSE_APP_URL ?? "https://pulse.helixsystems.ca";
  return raw.replace(/\/$/, "");
}

/**
 * Helix marketing (home, `/pulse` product page, contact). Default `www.helixsystems.ca`.
 * Override with `NEXT_PUBLIC_HELIX_MARKETING_URL`.
 */
function helixMarketingOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_HELIX_MARKETING_URL ?? "https://www.helixsystems.ca";
  return raw.replace(/\/$/, "");
}

/** Same-origin routes in this Next.js app (App Router). */
export const pulseRoutes = {
  login: "/login",
  overview: "/overview",
  schedule: "/schedule",
  projects: "/projects",
  monitoring: "/monitoring",
  /** @deprecated Use `monitoring`; kept for bookmarks and deep links. */
  operations: "/monitoring",
  equipment: "/equipment",
  /** Pulse product / marketing page (facility map, features, etc.). */
  pulseLanding: "/pulse",
} as const;

/** Tenant app — center nav when signed in (links into product areas). */
export const pulseTenantNav = [
  { href: "/overview", label: "Overview" },
  { href: "/schedule", label: "Schedule" },
  { href: "/monitoring", label: "Monitoring" },
  { href: "/projects", label: "Projects" },
  { href: "/dashboard/maintenance", label: "Work Requests" },
  { href: "/dashboard/procedures", label: "Procedures" },
  { href: "/dashboard/inventory", label: "Inventory" },
  { href: "/equipment", label: "Equipment" },
  { href: "/devices", label: "Zones & Devices" },
] as const;

/** System administration shell — center nav on `/system/*`. */
export const pulseSystemNav = [
  { href: "/system", label: "Overview" },
  { href: "/system/companies", label: "Companies" },
  { href: "/system/users", label: "Users" },
  { href: "/system/logs", label: "System Logs" },
] as const;

/**
 * Root left rail — icons by default, expands on hover (tenant / product areas).
 * Links map to routes and `/pulse` section IDs that exist today.
 */
export const pulseTenantSidebarNav = [
  { href: "/overview", label: "Dashboard", icon: "layout" as const },
  { href: "/dashboard/compliance", label: "Inspections & Logs", icon: "scroll-text" as const },
  { href: "/schedule", label: "Schedule", icon: "calendar" as const },
  { href: "/monitoring", label: "Monitoring", icon: "activity" as const },
  { href: "/projects", label: "Projects", icon: "folder-kanban" as const },
  { href: "/dashboard/maintenance", label: "Work Requests", icon: "clipboard" as const },
  { href: "/dashboard/procedures", label: "Procedures", icon: "list-checks" as const },
  { href: "/dashboard/workers", label: "Workers & Roles", icon: "user-cog" as const },
  { href: "/dashboard/inventory", label: "Inventory", icon: "package" as const },
  { href: "/equipment", label: "Equipment", icon: "wrench" as const },
  { href: "/zones-devices/zones", label: "Drawings", icon: "layers" as const },
  { href: "/devices", label: "Zones & Devices", icon: "map-pin" as const },
] as const;

/** System admin rail — platform tooling only; product modules live on the tenant rail. */
export const pulseSystemSidebarNav = [
  { href: "/system", label: "Dashboard", icon: "layout" as const },
  { href: "/system/companies", label: "Companies", icon: "building" as const },
  { href: "/system/users", label: "Users", icon: "user-cog" as const },
  { href: "/system/logs", label: "System Logs", icon: "scroll-text" as const },
] as const;

export type PulseSidebarIcon =
  | (typeof pulseTenantSidebarNav)[number]["icon"]
  | (typeof pulseSystemSidebarNav)[number]["icon"];

/** Absolute URL to a path on the Pulse app host (for `<a href>`, mailto templates, etc.). */
export function pulseAppHref(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${pulseAppOrigin()}${p}`;
}

/**
 * Send the browser to Pulse app sign-in. Prefer this over `router.replace('/login')` so
 * unauthenticated users on the marketing host land on `pulse.helixsystems.ca`.
 */
export function navigateToPulseLogin(): void {
  if (typeof window === "undefined") return;
  window.location.replace(pulseAppHref("/login"));
}

/** Open Pulse app overview on the configured app host (after sign-in). */
export function navigateToPulseOverview(): void {
  if (typeof window === "undefined") return;
  window.location.assign(pulseAppHref("/overview"));
}

/** Minimal fields from `/auth/me` or stored session for routing after sign-in. */
export type PulsePostLoginIdentity = {
  role?: string;
  is_system_admin?: boolean;
};

/**
 * System operators use `/system`; everyone else (tenant / company users) uses `/overview`.
 * Impersonation tokens look like a tenant — they stay on `/overview`.
 */
export function pulsePostLoginPath(user: PulsePostLoginIdentity): "/system" | "/overview" {
  if (user.is_system_admin === true || user.role === "system_admin") {
    return "/system";
  }
  return "/overview";
}

/** Same-origin navigation after successful login / invite / password reset. */
export function navigateAfterPulseLogin(user: PulsePostLoginIdentity): void {
  if (typeof window === "undefined") return;
  window.location.assign(pulseAppHref(pulsePostLoginPath(user)));
}

/** Marketing site URL with path and/or hash (e.g. `"/#contact"`). */
export function helixMarketingHref(pathWithOptionalHash: string): string {
  const p = pathWithOptionalHash.startsWith("/")
    ? pathWithOptionalHash
    : `/${pathWithOptionalHash}`;
  return `${helixMarketingOrigin()}${p}`;
}

export const pulseApp = {
  origin: pulseAppOrigin,

  /** Same as `pulseAppHref` — sign-in page on the Pulse host. */
  login(): string {
    return pulseAppHref("/login");
  },

  /** Dashboard and other authenticated routes on the Pulse host. */
  to(path: string): string {
    return pulseAppHref(path);
  },

  admin(): string {
    return pulseAppHref("/admin");
  },

  workRequests(): string {
    return pulseAppHref("/work-requests");
  },
};
