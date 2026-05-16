/**
 * Pulse product routing helpers: absolute URLs for the app host, post-login paths,
 * left-rail (`pulseTenantSidebarNav` / `pulseSystemSidebarNav`) and top-nav definitions,
 * and marketing-site links. Marketing vs Pulse app hosts are intentionally split.
 *
 * Default app origin: `panorama.helixsystems.ca` (legacy `pulse.helixsystems.ca` still supported via host list).
 * Override with `NEXT_PUBLIC_PULSE_APP_URL`.
 */
import { NAV_VISIBLE_MASTER_FEATURES } from "@/config/platform/master-feature-registry";
import { isPulseAppHost } from "@/lib/pulse-host";
import { isProductPath } from "@/lib/route-split-buckets";

function pulseAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_PULSE_APP_URL ?? "https://panorama.helixsystems.ca";
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
  { href: "/standards", label: "Standards" },
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

/** @deprecated Prefer `tenantSidebarNavItemsForSession` — registry-driven shared modules. */
export const pulseTenantSidebarNav = NAV_VISIBLE_MASTER_FEATURES.filter((m) => !m.platformRoute)
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((m) => ({
    href: m.route,
    label: m.label,
    icon: m.icon,
  })) as readonly {
  href: string;
  label: string;
  icon: (typeof NAV_VISIBLE_MASTER_FEATURES)[number]["icon"];
}[];

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

function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Login href for the current browser context.
 * - On the app host, Vercel preview, local dev, or any signed-in product route: same-origin `/login`.
 * - On the marketing host only: absolute URL to `NEXT_PUBLIC_PULSE_APP_URL/login`.
 */
export function pulseLoginHref(): string {
  if (typeof window === "undefined") {
    return pulseRoutes.login;
  }
  const host = window.location.hostname.toLowerCase();
  if (isPulseAppHost(host) || isLocalDevHost(host) || isProductPath(window.location.pathname)) {
    return pulseRoutes.login;
  }
  return pulseAppHref(pulseRoutes.login);
}

/**
 * Send the browser to sign-in. Logout and session expiry use this — stay on `/login` when already
 * inside the product app; only cross-origin when browsing the marketing site on a separate host.
 */
export function navigateToPulseLogin(): void {
  if (typeof window === "undefined") return;
  window.location.replace(pulseLoginHref());
}

/** Open Pulse app overview on the configured app host (after sign-in). */
export function navigateToPulseOverview(): void {
  if (typeof window === "undefined") return;
  window.location.assign(pulseAppHref("/overview"));
}

/** Minimal fields from `/auth/me` or stored session for routing after sign-in. */
export type PulsePostLoginIdentity = {
  role?: string;
  roles?: string[];
  is_system_admin?: boolean;
  must_change_password?: boolean;
};

/** Mirrors `sessionPrimaryRole` precedence without importing `pulse-roles` (avoids cycle with `pulse-session`). */
const POST_LOGIN_ROLE_PRECEDENCE = [
  "system_admin",
  "company_admin",
  "manager",
  "supervisor",
  "lead",
  "worker",
  "demo_viewer",
] as const;

function primaryRoleForPostLogin(user: PulsePostLoginIdentity): string {
  const list = user.roles?.length ? [...user.roles] : user.role ? [user.role] : [];
  if (!list.length) return "worker";
  let best = list[0]!;
  let bi = 999;
  for (const r of list) {
    const i = POST_LOGIN_ROLE_PRECEDENCE.indexOf(r as (typeof POST_LOGIN_ROLE_PRECEDENCE)[number]);
    const idx = i === -1 ? 999 : i;
    if (idx < bi) {
      bi = idx;
      best = r;
    }
  }
  return best;
}

/**
 * Post sign-in landing: system admins → `/system`; primary **worker** → `/worker`; everyone else (lead,
 * supervisor, manager, company_admin, demo_viewer, …) → `/overview`. Workers with a temp password see a
 * header badge linking to profile settings (no forced redirect).
 */
export function pulsePostLoginPath(user: PulsePostLoginIdentity): "/system" | "/overview" | "/worker" {
  if (
    user.is_system_admin === true ||
    user.role === "system_admin" ||
    Boolean(user.roles?.includes("system_admin"))
  ) {
    return "/system";
  }
  if (primaryRoleForPostLogin(user) === "worker") {
    return "/worker";
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

  /** Sign-in page — same-origin on app deployments; absolute on marketing-only host. */
  login(): string {
    return pulseLoginHref();
  },

  /** Dashboard and other authenticated routes on the Pulse host. */
  to(path: string): string {
    return pulseAppHref(path);
  },

  /** Tenant leadership / company admin dashboard (`/overview`). */
  admin(): string {
    return pulseAppHref("/overview");
  },

  workRequests(): string {
    return pulseAppHref("/work-requests");
  },
};
