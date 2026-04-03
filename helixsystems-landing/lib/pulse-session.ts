/**
 * Pulse auth persistence: `localStorage` session shape, read/write/clear, mock vs API login,
 * and helpers (`canAccessPulseTenantApis`, JWT expiry) used by `apiFetch` and route guards.
 */

import { normalizeApiBaseUrl } from "@/lib/api-base-url";

export const PULSE_AUTH_STORAGE_KEY = "pulse_auth_v1";

/** `sessionStorage` flag for the post-login welcome overlay; cleared when auth ends so the next sign-in can show it. */
export const PULSE_WELCOME_SESSION_KEY = "welcome_shown";

/** Skip onboarding intro modal until next session (Start Setup / Skip for Now). */
export const PULSE_ONBOARDING_INTRO_SESSION_KEY = "pulse_onboarding_intro_dismissed";

/** Hide the incomplete-setup reminder banner until next session. */
export const PULSE_ONBOARDING_BANNER_SESSION_KEY = "pulse_onboarding_banner_dismissed";

/** Populated from `/api/v1/auth/me` for tenant users. */
export type CompanySummary = {
  id: string;
  name: string;
  logo_url?: string | null;
  /** Operations dashboard banner only; not shown in global nav. */
  header_image_url?: string | null;
};

export type PulseAuthSession = {
  access_token?: string;
  sub: string;
  email: string;
  role?: string;
  company_id?: string | null;
  full_name?: string | null;
  is_system_admin?: boolean;
  /** From `/auth/me`; when missing (legacy session), tenant nav shows all modules. */
  enabled_features?: string[];
  /** Tenant branding; absent for system_admin or legacy sessions. */
  company?: CompanySummary | null;
  /** From `/auth/me`; guides onboarding UI for tenant users. */
  onboarding_enabled?: boolean;
  onboarding_completed?: boolean;
  iat: number;
  exp: number;
  remember: boolean;
};

export type UserOut = {
  id: string;
  email: string;
  company_id?: string | null;
  role: string;
  full_name?: string | null;
  enabled_features?: string[];
  is_impersonating?: boolean;
  is_system_admin?: boolean;
  company?: CompanySummary | null;
  onboarding_enabled?: boolean;
  onboarding_completed?: boolean;
};

function emitAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("pulse-auth-change"));
}

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function readSession(): PulseAuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PULSE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PulseAuthSession;
    if (typeof data.exp !== "number" || data.exp * 1000 <= Date.now()) {
      clearSessionQuiet();
      return null;
    }
    return data;
  } catch {
    clearSessionQuiet();
    return null;
  }
}

function clearSessionQuiet() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PULSE_AUTH_STORAGE_KEY);
  document.cookie = "pulse_session=; path=/; max-age=0; SameSite=Lax";
  try {
    sessionStorage.removeItem(PULSE_WELCOME_SESSION_KEY);
    sessionStorage.removeItem(PULSE_ONBOARDING_INTRO_SESSION_KEY);
    sessionStorage.removeItem(PULSE_ONBOARDING_BANNER_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  clearSessionQuiet();
  emitAuthChange();
}

export function isLoggedIn(): boolean {
  return readSession() !== null;
}

/** True when this JWT session may call `/api/v1/pulse/*` (tenant users only; system admin must impersonate). */
export function canAccessPulseTenantApis(session: PulseAuthSession | null): boolean {
  if (!session?.access_token) return false;
  if (session.is_system_admin === true || session.role === "system_admin") return false;
  const cid = session.company_id;
  return cid != null && String(cid).length > 0;
}

export function writeSession(email: string, remember: boolean) {
  if (typeof window === "undefined") return;
  const now = Math.floor(Date.now() / 1000);
  const ttlSec = remember ? 60 * 60 * 24 * 14 : 60 * 60 * 8;
  const payload: PulseAuthSession = {
    sub: "mock_user",
    email,
    iat: now,
    exp: now + ttlSec,
    remember,
  };
  localStorage.setItem(PULSE_AUTH_STORAGE_KEY, JSON.stringify(payload));
  document.cookie = `pulse_session=1; path=/; max-age=${ttlSec}; SameSite=Lax`;
  emitAuthChange();
}

export function writeApiSession(
  accessToken: string,
  user: UserOut,
  remember: boolean,
) {
  if (typeof window === "undefined") return;
  const jwtExp = decodeJwtExp(accessToken);
  const now = Math.floor(Date.now() / 1000);
  const fallbackTtl = remember ? 60 * 60 * 24 * 14 : 60 * 60 * 8;
  const exp = jwtExp ?? now + fallbackTtl;
  const payload: PulseAuthSession = {
    access_token: accessToken,
    sub: user.id,
    email: user.email,
    role: user.role,
    company_id: user.company_id ?? null,
    full_name: user.full_name ?? null,
    is_system_admin: user.is_system_admin,
    enabled_features: user.enabled_features,
    company: user.company ?? null,
    onboarding_enabled: user.onboarding_enabled,
    onboarding_completed: user.onboarding_completed,
    iat: now,
    exp,
    remember,
  };
  const ttlSec = Math.max(60, exp - now);
  localStorage.setItem(PULSE_AUTH_STORAGE_KEY, JSON.stringify(payload));
  document.cookie = `pulse_session=1; path=/; max-age=${ttlSec}; SameSite=Lax`;
  emitAuthChange();
}

export const PULSE_DEMO_EMAIL = "demo@helixsystems.ca";
export const PULSE_DEMO_PASSWORD = "pulse-demo";

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: "invalid_credentials" | "missing_fields" | "validation" | "api_config" };

export function validateIdentifier(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
  return v.length >= 3 && /^[a-zA-Z0-9._-]+$/.test(v);
}

export function isEmailShape(value: string): boolean {
  const v = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** When NEXT_PUBLIC_PULSE_LOGIN_EMAIL_DOMAIN is set, "sysadmin" → "sysadmin@domain". */
export function expandLoginEmail(identifier: string): string {
  const t = identifier.trim();
  if (t.includes("@")) return t.toLowerCase();
  const domain = process.env.NEXT_PUBLIC_PULSE_LOGIN_EMAIL_DOMAIN?.trim();
  if (domain) return `${t}@${domain}`.toLowerCase();
  return t;
}

export async function attemptMockLogin(
  identifier: string,
  password: string,
): Promise<LoginResult> {
  await new Promise((r) => setTimeout(r, 650));

  const id = identifier.trim();
  const pw = password;
  if (!id || !pw) {
    return { ok: false, reason: "missing_fields" };
  }
  if (!validateIdentifier(id)) {
    return { ok: false, reason: "validation" };
  }

  const emailLower = id.toLowerCase();
  if (emailLower === PULSE_DEMO_EMAIL.toLowerCase() && pw === PULSE_DEMO_PASSWORD) {
    return { ok: true };
  }

  return { ok: false, reason: "invalid_credentials" };
}

type TokenResponse = { access_token: string; token_type?: string };

export async function loginWithBackend(
  email: string,
  password: string,
): Promise<
  { ok: true; token: string; user: UserOut } | { ok: false; reason: "invalid_credentials" | "api_config" }
> {
  const base = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  if (!base) {
    return { ok: false, reason: "api_config" };
  }
  const loginRes = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!loginRes.ok) {
    return { ok: false, reason: "invalid_credentials" };
  }
  const tokenJson = (await loginRes.json()) as TokenResponse;
  const token = tokenJson.access_token;
  const meRes = await fetch(`${base}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) {
    return { ok: false, reason: "invalid_credentials" };
  }
  const user = (await meRes.json()) as UserOut;
  return { ok: true, token, user };
}
