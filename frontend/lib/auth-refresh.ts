/**
 * OAuth-style refresh rotation (AUTH_SESSION_MODE=dual). Access JWT stays in `pulse_auth_v2`;
 * refresh token is kept in sessionStorage to reduce persistent XSS exposure vs localStorage.
 */

import { normalizeApiBaseUrl } from "@/lib/api-base-url";

function getApiBaseUrl(): string {
  return normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
}
import { isRefreshTokenEnabled } from "@/lib/auth-session-mode";
import {
  clearStoredRefreshToken,
  readStoredRefreshToken,
  writeStoredRefreshToken,
} from "@/lib/auth-token-storage";
import { logPulseAuth } from "@/lib/pulse-auth-lifecycle";
import { parseApiResponseJson } from "@/lib/parse-api-json-response";
import {
  isPulseAuthTeardown,
  readSession,
  writeApiSession,
  type UserOut,
} from "@/lib/pulse-session";
import { applyServerTimeFromUserOut } from "@/lib/serverTime";

export type TokenPairResponse = {
  access_token: string;
  token_type?: string;
  refresh_token?: string | null;
};

export function persistRefreshTokenFromLogin(token: TokenPairResponse): void {
  if (!isRefreshTokenEnabled()) return;
  const rt = token.refresh_token?.trim();
  if (rt) writeStoredRefreshToken(rt);
}

let refreshInFlight: Promise<boolean> | null = null;

function pathAllowsRefreshRecovery(apiPath: string): boolean {
  const p = apiPath.toLowerCase();
  if (p.includes("/auth/login")) return false;
  if (p.includes("/auth/refresh")) return false;
  if (p.includes("/auth/logout")) return false;
  if (p.includes("/auth/oauth/")) return false;
  return true;
}

/** POST /auth/refresh — returns true when a new access token was stored. */
export async function tryRefreshAccessToken(): Promise<boolean> {
  if (!isRefreshTokenEnabled()) return false;
  if (typeof window === "undefined") return false;
  if (isPulseAuthTeardown()) return false;

  const refresh = readStoredRefreshToken();
  if (!refresh) return false;

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const base = getApiBaseUrl();
    if (!base) return false;
    const url = `${base}/api/v1/auth/refresh`;
    logPulseAuth("token-refresh-start", { kind: "refresh-token" });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      const text = await res.text();
      if (!res.ok) {
        logPulseAuth("token-refresh-skipped", {
          kind: "refresh-token",
          reason: `http-${res.status}`,
        });
        if (res.status === 401) clearStoredRefreshToken();
        return false;
      }
      const data = parseApiResponseJson(text, { ok: true, status: res.status, url }) as TokenPairResponse;
      if (!data.access_token) return false;

      const remember = readSession()?.remember ?? false;
      const meUrl = `${base}/api/v1/auth/me`;
      const meRes = await fetch(meUrl, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (!meRes.ok) return false;
      const meText = await meRes.text();
      const user = parseApiResponseJson(meText, { ok: true, status: meRes.status, url: meUrl }) as UserOut;
      applyServerTimeFromUserOut(user);
      writeApiSession(data.access_token, user, remember, { allowDuringTeardown: true });
      if (data.refresh_token?.trim()) {
        writeStoredRefreshToken(data.refresh_token.trim());
      }
      logPulseAuth("token-refresh-done", { kind: "refresh-token", email: user.email });
      return true;
    } catch {
      logPulseAuth("token-refresh-skipped", { kind: "refresh-token", reason: "network" });
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Attempt refresh before treating JWT expiry as a hard logout (dual mode only). */
export async function tryRecoverExpiredSession(): Promise<boolean> {
  if (!isRefreshTokenEnabled()) return false;
  return tryRefreshAccessToken();
}

export function shouldAttemptRefreshOn401(requestUrl: string): boolean {
  if (!isRefreshTokenEnabled()) return false;
  try {
    const path = requestUrl.startsWith("http")
      ? new URL(requestUrl).pathname
      : requestUrl.split("?")[0];
    return pathAllowsRefreshRecovery(path);
  } catch {
    return false;
  }
}

/** Revoke refresh sessions server-side before clearing local storage. */
export async function revokeRefreshSessionsOnLogout(): Promise<void> {
  if (!isRefreshTokenEnabled()) return;
  const base = getApiBaseUrl();
  if (!base) return;

  const refresh = readStoredRefreshToken();
  const access = readSession()?.access_token;

  try {
    if (refresh) {
      await fetch(`${base}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
    }
  } catch {
    /* best effort */
  }

  try {
    if (access) {
      await fetch(`${base}/api/v1/auth/logout/all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}` },
      });
    }
  } catch {
    /* best effort */
  }

  clearStoredRefreshToken();
}

export { clearStoredRefreshToken, readStoredRefreshToken };
