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
  /** Pulse product / marketing page (facility map, features, etc.). */
  pulseLanding: "/pulse",
} as const;

/** Tenant app — center nav when signed in (links into product areas). */
export const pulseTenantNav = [
  { href: "/overview", label: "Overview" },
  { href: "/pulse#work-requests", label: "Work orders" },
  { href: "/pulse#inventory", label: "Inventory" },
  { href: "/pulse#workforce-scheduling", label: "Scheduling" },
] as const;

/** System administration shell — center nav on `/system/*`. */
export const pulseSystemNav = [
  { href: "/system", label: "Overview" },
  { href: "/system/companies", label: "Companies" },
  { href: "/system/users", label: "Users" },
  { href: "/system/logs", label: "System logs" },
] as const;

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
