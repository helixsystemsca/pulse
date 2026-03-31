/**
 * Base URL for the Pulse web application (Operations Intelligence / worker-admin app).
 * Deploy helixsystems.ca as marketing; point this at pulse.example.com or /app as you prefer.
 */
function origin(): string {
  const raw = process.env.NEXT_PUBLIC_PULSE_APP_URL ?? "https://app.helixsystems.ca";
  return raw.replace(/\/$/, "");
}

/** Same-origin routes in this Next.js app (App Router). */
export const pulseRoutes = {
  login: "/login",
  overview: "/overview",
  schedule: "/schedule",
  /** Pulse product / marketing page (facility map, features, etc.). */
  pulseLanding: "/pulse",
} as const;

/** Tenant app — center nav when signed in (links into product areas). */
export const pulseTenantNav = [
  { href: "/overview", label: "Overview" },
  { href: "/schedule", label: "Schedule" },
  { href: "/pulse#work-requests", label: "Work orders" },
  { href: "/pulse#inventory", label: "Inventory" },
] as const;

/** System administration shell — center nav on `/system/*`. */
export const pulseSystemNav = [
  { href: "/system", label: "Overview" },
  { href: "/system/companies", label: "Companies" },
  { href: "/system/users", label: "Users" },
  { href: "/system/logs", label: "System logs" },
] as const;

/**
 * Root left rail — icons by default, expands on hover (tenant / product areas).
 * Links map to routes and `/pulse` section IDs that exist today.
 */
export const pulseTenantSidebarNav = [
  { href: "/overview", label: "Dashboard", icon: "layout" as const },
  { href: "/schedule", label: "Schedule", icon: "calendar" as const },
  { href: "/pulse#work-requests", label: "Issue tracking", icon: "clipboard" as const },
  { href: "/pulse#inventory", label: "Inventory", icon: "package" as const },
  { href: "/pulse#tool-tracking", label: "Equipment", icon: "wrench" as const },
  { href: "/pulse#workforce-scheduling", label: "Workforce", icon: "users" as const },
  { href: "/pulse#equipment-setup", label: "Zones & devices", icon: "map-pin" as const },
  { href: "/pulse#admin-panel", label: "Control panel", icon: "gauge" as const },
] as const;

/** System admin rail (alongside top tabs). */
export const pulseSystemSidebarNav = [
  { href: "/overview", label: "Operations", icon: "layout" as const },
  { href: "/system", label: "Admin home", icon: "shield" as const },
  { href: "/system/companies", label: "Companies", icon: "building" as const },
  { href: "/system/users", label: "Users", icon: "user-cog" as const },
  { href: "/system/logs", label: "System logs", icon: "scroll-text" as const },
] as const;

export type PulseSidebarIcon =
  | (typeof pulseTenantSidebarNav)[number]["icon"]
  | (typeof pulseSystemSidebarNav)[number]["icon"];

export const pulseApp = {
  origin,

  login(): string {
    return `${origin()}/login`;
  },

  admin(): string {
    return `${origin()}/admin`;
  },

  workRequests(): string {
    return `${origin()}/work-requests`;
  },
};
