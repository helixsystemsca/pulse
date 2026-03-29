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
} as const;

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
