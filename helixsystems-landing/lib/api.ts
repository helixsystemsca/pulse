/**
 * Browser client for the Operations Intelligence backend: resolves `NEXT_PUBLIC_API_URL`,
 * attaches the Pulse session bearer token, and throws structured errors for non-OK responses.
 */
import { normalizeApiBaseUrl } from "@/lib/api-base-url";
import { readSession, writeApiSession, type UserOut } from "@/lib/pulse-session";

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
  const session = readSession();
  if (session?.access_token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
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

export async function refreshSessionWithToken(token: string, remember: boolean): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const meRes = await fetch(`${base}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) throw new Error("Session refresh failed");
  const user = (await meRes.json()) as UserOut;
  writeApiSession(token, user, remember);
}

/** Re-fetch `/auth/me` and update stored session (e.g. after onboarding PATCH). */
export async function refreshPulseUserFromServer(): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) return;
  const s = readSession();
  if (!s?.access_token) return;
  const meRes = await fetch(`${base}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${s.access_token}` },
  });
  if (!meRes.ok) return;
  const user = (await meRes.json()) as UserOut;
  writeApiSession(s.access_token, user, s.remember);
}
