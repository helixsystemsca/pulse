/**
 * Paths that skip {@link canAccessClassicNavHref} in the tenant chrome guard (no product RBAC required).
 * Marketing, auth handshakes, system shell, kiosk displays, and similar entry points.
 *
 * Product pages must NOT be listed here — they are default-deny unless `classicNavGate` grants access.
 */
export const TENANT_RBAC_GUARD_BYPASS_PREFIXES: readonly string[] = [
  "/login",
  "/invite",
  "/invite-accept",
  "/join",
  "/password-reset",
  "/reset-password",
  "/auth/callback",
  "/system",
  "/pulse",
  "/kiosk",
  "/api",
  "/demo",
  "/landing-variants",
];
