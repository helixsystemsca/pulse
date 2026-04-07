/**
 * Browser client for the Operations Intelligence backend: resolves `NEXT_PUBLIC_API_URL`,
 * attaches the Pulse session bearer token, and throws structured errors for non-OK responses.
 */
import { normalizeApiBaseUrl } from "@/lib/api-base-url";
import { getImpersonationOverlayAccessToken, setImpersonationOverlayAccessToken } from "@/lib/impersonation-overlay-token";
import { readSession, writeApiSession, type UserOut } from "@/lib/pulse-session";
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

export function getApiBaseUrl(): string {
  return normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
}

export function isApiMode(): boolean {
  return Boolean(getApiBaseUrl()) && process.env.NEXT_PUBLIC_USE_MOCK_AUTH !== "true";
}

export type ApiErrorBody = {
  detail?: unknown;
};

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const base = getApiBaseUrl();
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
  const res = await fetch(url, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const err = new Error(`API ${res.status}`) as Error & { status: number; body: unknown; requestUrl: string };
    err.status = res.status;
    err.body = data;
    err.requestUrl = url;
    throw err;
  }
  return data as T;
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
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const err = new Error(`API ${res.status}`) as Error & { status: number; body: unknown; requestUrl: string };
    err.status = res.status;
    err.body = data;
    err.requestUrl = url;
    throw err;
  }
  return data as T;
}

export async function refreshSessionWithToken(token: string, remember: boolean): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const meRes = await fetch(`${base}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) throw new Error("Session refresh failed");
  const user = (await meRes.json()) as UserOut;
  applyServerTimeFromUserOut(user);
  writeApiSession(token, user, remember);
}

/** Re-fetch `/auth/me` and update stored session (e.g. after onboarding PATCH). */
export async function refreshPulseUserFromServer(): Promise<void> {
  if (getImpersonationOverlayAccessToken()) return;
  const base = getApiBaseUrl();
  if (!base) return;
  const s = readSession();
  if (!s?.access_token) return;
  const meRes = await fetch(`${base}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${s.access_token}` },
  });
  if (!meRes.ok) return;
  const user = (await meRes.json()) as UserOut;
  applyServerTimeFromUserOut(user);
  writeApiSession(s.access_token, user, s.remember);
}
