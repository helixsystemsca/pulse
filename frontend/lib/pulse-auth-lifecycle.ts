/**
 * Auth lifecycle helpers: structured debug logging and coordinated sign-out.
 * Pulse API auth is Bearer JWT in `localStorage` (`pulse_auth_v2`), not API-domain cookies.
 * Microsoft SSO also keeps a Supabase session in browser storage until explicitly cleared.
 */

import { navigateToPulseLogin } from "@/lib/pulse-app";
import { signOutSupabaseIdentity } from "@/lib/microsoft-auth";
import {
  clearSession,
  isPulseAuthTeardown,
  isLoggedIn,
  readSession,
} from "@/lib/pulse-session";

export type PulseAuthLogEvent =
  | "logout-start"
  | "logout-supabase-done"
  | "logout-cleared"
  | "logout-redirect"
  | "session-read"
  | "session-write-skipped"
  | "session-write"
  | "session-cleared"
  | "teardown-begin"
  | "teardown-end"
  | "token-refresh-start"
  | "token-refresh-done"
  | "token-refresh-skipped"
  | "redirect-login"
  | "redirect-after-login"
  | "auth-hook-refresh"
  | "supabase-signout-error";

const AUTH_DEBUG =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_PULSE_AUTH_DEBUG === "true" ||
    process.env.NODE_ENV === "development");

/** Filterable console diagnostics for logout / restore races (enable in prod via NEXT_PUBLIC_PULSE_AUTH_DEBUG). */
export function logPulseAuth(event: PulseAuthLogEvent, detail?: Record<string, unknown>): void {
  if (!AUTH_DEBUG || typeof console === "undefined") return;
  const payload = detail ? { ...detail } : undefined;
  console.debug(`[pulse-auth] ${event}`, payload ?? "");
}

export type PulseLogoutReason = "user" | "inactivity" | "session-expired";

let logoutInFlight: Promise<void> | null = null;

/**
 * Full sign-out: block session restores, clear Pulse + Supabase local identity, then go to `/login`.
 * Safe to call multiple times (deduped while in flight).
 */
export async function performPulseLogout(reason: PulseLogoutReason = "user"): Promise<void> {
  if (logoutInFlight) {
    logPulseAuth("logout-start", { reason, deduped: true });
    return logoutInFlight;
  }

  logoutInFlight = (async () => {
    logPulseAuth("logout-start", {
      reason,
      hadSession: isLoggedIn(),
      pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
    try {
      await signOutSupabaseIdentity();
      logPulseAuth("logout-supabase-done", { reason });
    } catch (err) {
      logPulseAuth("supabase-signout-error", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
    clearSession();
    logPulseAuth("logout-cleared", { reason });
    navigateToPulseLogin();
    logPulseAuth("logout-redirect", { reason });
  })().finally(() => {
    logoutInFlight = null;
  });

  return logoutInFlight;
}

/** True while an explicit logout is clearing storage (straggling `/auth/me` must not re-hydrate). */
export function isPulseLogoutInFlight(): boolean {
  return logoutInFlight !== null;
}

export function logSessionRead(result: "ok" | "missing" | "expired"): void {
  logPulseAuth("session-read", { result });
}

export function logAuthHookRefresh(source: "mount" | "pulse-auth-change" | "storage"): void {
  logPulseAuth("auth-hook-refresh", {
    source,
    teardown: isPulseAuthTeardown(),
    logoutInFlight: isPulseLogoutInFlight(),
    authed: isLoggedIn(),
  });
}

export function logRedirectLogin(from: string): void {
  logPulseAuth("redirect-login", { from });
}

export function logRedirectAfterLogin(path: string): void {
  logPulseAuth("redirect-after-login", { path, email: readSession()?.email });
}
