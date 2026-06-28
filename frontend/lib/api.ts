/**
 * Browser client for the Operations Intelligence backend: resolves `NEXT_PUBLIC_API_URL`,
 * attaches the Pulse session bearer token, and throws structured errors for non-OK responses.
 */
import { normalizeApiBaseUrl } from "@/lib/api-base-url";
import { parseApiResponseJson } from "@/lib/parse-api-json-response";
import { getImpersonationOverlayAccessToken, setImpersonationOverlayAccessToken } from "@/lib/impersonation-overlay-token";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import {
  clearSession,
  isPulseAuthTeardown,
  isPulsePublicPath,
  readSession,
  writeApiSession,
  type UserOut,
} from "@/lib/pulse-session";
import { shouldAttemptRefreshOn401, tryRefreshAccessToken } from "@/lib/auth-refresh";
import { logPulseAuth } from "@/lib/pulse-auth-lifecycle";
import { applyServerTimeFromUserOut } from "@/lib/serverTime";

export { setImpersonationOverlayAccessToken };

function pathOnlyFromUrl(url: string): string {
  try {
    return url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
  } catch {
    return url.split("?")[0];
  }
}

/** System routes and `/auth/me` use the stored session; other routes use impersonation overlay when active. */
function bearerTokenForRequest(url: string): string | undefined {
  const path = pathOnlyFromUrl(url);
  if (path.includes("/api/system")) {
    return readSession()?.access_token;
  }
  // System shell and session helpers must read the admin principal, not the in-modal impersonation JWT.
  if (path === "/api/v1/auth/me" || path.endsWith("/api/v1/auth/me")) {
    return readSession()?.access_token;
  }
  const overlay = getImpersonationOverlayAccessToken();
  if (overlay) return overlay;
  return readSession()?.access_token;
}

/** Bearer for tenant API calls (REST and WebSocket). Honors impersonation overlay when active. */
export function getTenantApiBearerToken(): string | undefined {
  const overlay = getImpersonationOverlayAccessToken();
  if (overlay) return overlay;
  return readSession()?.access_token;
}

/** Bearer for authenticated `fetch` to API URLs (e.g. loading protected images where `<img src>` cannot attach headers). */
export function getApiBearerForUrl(url: string): string | undefined {
  return bearerTokenForRequest(url);
}

export function getApiBaseUrl(): string {
  return normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
}

export function isApiMode(): boolean {
  return Boolean(getApiBaseUrl()) && process.env.NEXT_PUBLIC_USE_MOCK_AUTH !== "true";
}

function pathSkips401SessionRedirect(apiPath: string): boolean {
  return apiPath.toLowerCase().includes("/auth/login");
}

/** True when the resolved API URL is on a different origin than the Pulse app (typical production: Vercel → Render). */
function isCrossOriginApiUrl(url: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(url).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Pulse API auth uses `Authorization: Bearer` from `localStorage` (`pulse_auth_v2`), not API-domain cookies.
 * The `pulse_session` cookie is same-site for the Next app only. We still set `credentials: "include"` on
 * cross-origin calls so credentialed CORS (`allow_credentials=True` on the API) stays consistent if cookies are added later.
 */
function fetchCredentialsForUrl(url: string, init?: RequestInit): RequestCredentials {
  if (init?.credentials !== undefined) return init.credentials;
  return isCrossOriginApiUrl(url) ? "include" : "same-origin";
}

async function fetchWithAuthRefreshRetry(
  url: string,
  init: RequestInit,
  hadBearer: boolean,
): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status === 401 && hadBearer && shouldAttemptRefreshOn401(url)) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      const headers = new Headers(init.headers);
      const retryBearer = bearerTokenForRequest(url);
      if (retryBearer) {
        headers.set("Authorization", `Bearer ${retryBearer}`);
      } else {
        headers.delete("Authorization");
      }
      res = await fetch(url, {
        ...init,
        headers,
        credentials: fetchCredentialsForUrl(url, init),
      });
    }
  }
  return res;
}

/**
 * When an API call returns 401 with a bearer we sent: clear impersonation overlay (tenant preview)
 * or end the Pulse session and go to sign-in so the UI cannot stay “logged in” with a dead token.
 */
export function handleSessionExpiredFromApiResponse(
  requestUrl: string,
  responseStatus: number,
  hadAuthorizationBearer: boolean,
): void {
  if (responseStatus !== 401 || !hadAuthorizationBearer) return;
  if (typeof window === "undefined") return;
  const apiPath = pathOnlyFromUrl(requestUrl);
  if (pathSkips401SessionRedirect(apiPath)) return;
  if (isPulsePublicPath(window.location.pathname)) return;

  const overlay = getImpersonationOverlayAccessToken();
  const systemOrMe =
    apiPath.includes("/api/system") ||
    apiPath === "/api/v1/auth/me" ||
    apiPath.endsWith("/api/v1/auth/me");

  if (overlay && !systemOrMe) {
    setImpersonationOverlayAccessToken(null);
    return;
  }

  clearSession();
  navigateToPulseLogin();
}

export type ApiErrorBody = {
  detail?: unknown;
};

export type ApiFetchError = Error & {
  status?: number;
  body?: unknown;
  requestUrl?: string;
  /** Browser blocked the response or the connection failed (often reported as CORS in DevTools). */
  networkError?: boolean;
};

function isLikelyNetworkOrCorsFailure(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed")
  );
}

/** Map API failures to user-facing copy (401 after deploy is often mistaken for CORS). */
export function classifyApiFailure(err: unknown): {
  kind: "session_expired" | "forbidden" | "network" | "server" | "unknown";
  userMessage: string;
} {
  const e = err as ApiFetchError;
  if (e?.networkError || isLikelyNetworkOrCorsFailure(err)) {
    return {
      kind: "network",
      userMessage:
        "Could not reach the API (network or server waking up). Wait a moment and Retry, or sign out and sign in again if this keeps happening.",
    };
  }
  if (e?.status === 401) {
    return {
      kind: "session_expired",
      userMessage:
        "Your session is no longer valid — common after a deploy or permission change. Sign out, sign in again, then reload.",
    };
  }
  if (e?.status === 403) {
    return {
      kind: "forbidden",
      userMessage:
        "You don’t have access to this dashboard with the current account. Tenant users see live data here; system admins should impersonate a company user from System admin.",
    };
  }
  if (typeof e?.status === "number" && e.status >= 500) {
    return {
      kind: "server",
      userMessage:
        "The API returned a server error. Try Retry; if DevTools → Network shows HTTP 500 (not 401), check Render logs for that route.",
    };
  }
  return {
    kind: "unknown",
    userMessage: "Could not load dashboard. Check that the API is running and you are signed in.",
  };
}

function resolveApiFetchBase(init?: { sameOrigin?: boolean }): string {
  if (init?.sameOrigin) {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return getApiBaseUrl();
  }
  return getApiBaseUrl();
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown; sameOrigin?: boolean },
): Promise<T> {
  const base = resolveApiFetchBase(init);
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const bearer = bearerTokenForRequest(url);
  if (bearer && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${bearer}`);
  }
  const fetchInit: RequestInit = {
    ...init,
    headers,
    credentials: fetchCredentialsForUrl(url, init),
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  };
  let res: Response;
  try {
    res = await fetchWithAuthRefreshRetry(url, fetchInit, Boolean(bearer));
  } catch (err) {
    if (isLikelyNetworkOrCorsFailure(err)) {
      const networkErr = new Error("Network request failed") as ApiFetchError;
      networkErr.networkError = true;
      networkErr.requestUrl = url;
      throw networkErr;
    }
    throw err;
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    data = parseApiResponseJson(text, { ok: res.ok, status: res.status, url });
  }
  if (!res.ok) {
    handleSessionExpiredFromApiResponse(url, res.status, Boolean(bearer));
    const msg = isPulseAuthTeardown() ? "" : `API ${res.status}`;
    const err = new Error(msg) as ApiFetchError;
    err.status = res.status;
    err.body = data;
    err.requestUrl = url;
    throw err;
  }
  return data as T;
}

/** Authenticated binary fetch (e.g. PDF) — does not JSON-parse the body. */
export async function apiFetchBlob(path: string, init?: RequestInit): Promise<Blob> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(init?.headers);
  const bearer = bearerTokenForRequest(url);
  if (bearer && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${bearer}`);
  }
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: fetchCredentialsForUrl(url, init),
  });
  if (!res.ok) {
    handleSessionExpiredFromApiResponse(url, res.status, Boolean(bearer));
    const msg = isPulseAuthTeardown() ? "" : `API ${res.status}`;
    const err = new Error(msg) as Error & { status: number; body: unknown; requestUrl: string };
    err.status = res.status;
    err.body = await res.text().catch(() => null);
    err.requestUrl = url;
    throw err;
  }
  return res.blob();
}

/** POST `multipart/form-data` (e.g. file upload). Do not set `Content-Type` manually — browser sets boundary. */
export async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers();
  const bearer = bearerTokenForRequest(url);
  if (bearer && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${bearer}`);
  }
  const res = await fetchWithAuthRefreshRetry(
    url,
    {
      method: "POST",
      headers,
      credentials: fetchCredentialsForUrl(url),
      body: formData,
    },
    Boolean(bearer),
  );
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    data = parseApiResponseJson(text, { ok: res.ok, status: res.status, url });
  }
  if (!res.ok) {
    handleSessionExpiredFromApiResponse(url, res.status, Boolean(bearer));
    const msg = isPulseAuthTeardown() ? "" : `API ${res.status}`;
    const err = new Error(msg) as Error & { status: number; body: unknown; requestUrl: string };
    err.status = res.status;
    err.body = data;
    err.requestUrl = url;
    throw err;
  }
  return data as T;
}

export async function refreshSessionWithToken(
  token: string,
  remember: boolean,
  options?: { resetWelcomeOverlay?: boolean; refreshToken?: string | null },
): Promise<void> {
  logPulseAuth("token-refresh-start", { kind: "with-token" });
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const meUrl = `${base}/api/v1/auth/me`;
  const meRes = await fetch(meUrl, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: fetchCredentialsForUrl(meUrl),
  });
  if (!meRes.ok) throw new Error("Session refresh failed");
  const meText = await meRes.text();
  const user = parseApiResponseJson(meText, { ok: true, status: meRes.status, url: meUrl }) as UserOut;
  applyServerTimeFromUserOut(user);
  writeApiSession(token, user, remember, {
    allowDuringTeardown: true,
    resetWelcomeOverlay: options?.resetWelcomeOverlay,
  });
  logPulseAuth("token-refresh-done", { kind: "with-token", email: user.email });
}

/** Re-fetch `/auth/me` and update stored session. */
export async function refreshPulseUserFromServer(): Promise<void> {
  if (getImpersonationOverlayAccessToken()) return;
  if (isPulseAuthTeardown()) {
    logPulseAuth("token-refresh-skipped", { kind: "me", reason: "teardown-active" });
    return;
  }
  const base = getApiBaseUrl();
  if (!base) return;
  const s = readSession();
  if (!s?.access_token) return;
  logPulseAuth("token-refresh-start", { kind: "me" });
  const meUrl = `${base}/api/v1/auth/me`;
  const meRes = await fetch(meUrl, {
    headers: { Authorization: `Bearer ${s.access_token}` },
    credentials: fetchCredentialsForUrl(meUrl),
  });
  if (!meRes.ok) {
    if (meRes.status === 401) {
      handleSessionExpiredFromApiResponse(meUrl, 401, Boolean(s.access_token));
    }
    return;
  }
  if (isPulseAuthTeardown()) {
    logPulseAuth("token-refresh-skipped", { kind: "me", reason: "teardown-after-fetch" });
    return;
  }
  const meText = await meRes.text();
  const user = parseApiResponseJson(meText, { ok: true, status: meRes.status, url: meUrl }) as UserOut;
  applyServerTimeFromUserOut(user);
  writeApiSession(s.access_token, user, s.remember);
  logPulseAuth("token-refresh-done", { kind: "me", email: user.email });
}
