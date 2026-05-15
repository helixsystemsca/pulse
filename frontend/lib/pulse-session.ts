/**
 * Pulse auth persistence: `localStorage` session shape, read/write/clear, mock vs API login,
 * and helpers (`canAccessPulseTenantApis`, JWT expiry) used by `apiFetch` and route guards.
 */

import { normalizeApiBaseUrl } from "@/lib/api-base-url";
import {
  getImpersonationOverlayAccessToken,
  setImpersonationOverlayAccessToken,
} from "@/lib/impersonation-overlay-token";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { applyServerTimeFromUserOut } from "@/lib/serverTime";

export const PULSE_AUTH_STORAGE_KEY = "pulse_auth_v2";

const PUBLIC_PATH_PREFIXES = ["/login", "/auth/callback", "/invite", "/reset-password"] as const;

/** Routes where we do not redirect to sign-in when the stored session is cleared (login, invite, password reset). */
export function isPulsePublicPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Wall-clock session cap when JWT `exp` is missing (seconds). Matches default backend `ACCESS_TOKEN_EXPIRE_MINUTES`. */
const SESSION_FALLBACK_TTL_SEC = 62 * 60;

/** `sessionStorage` flag for the post-login welcome overlay; cleared when auth ends so the next sign-in can show it. */
export const PULSE_WELCOME_SESSION_KEY = "welcome_shown";

/** Populated from `/api/v1/auth/me` for tenant users. */
export type CompanySummary = {
  id: string;
  name: string;
  logo_url?: string | null;
  /** Operations dashboard banner only; not shown in global nav. */
  header_image_url?: string | null;
  /** Mobile / app blurred hero; may be `/api/v1/company/background` after upload. */
  background_image_url?: string | null;
  timezone?: string | null;
  industry?: string | null;
};

export type PulseAuthSession = {
  access_token?: string;
  sub: string;
  email: string;
  role?: string;
  /** All assigned roles (tenant); `role` remains highest-precedence for legacy checks. */
  roles?: string[];
  company_id?: string | null;
  full_name?: string | null;
  auth_provider?: "email" | "microsoft" | string;
  avatar_url?: string | null;
  job_title?: string | null;
  /** Workforce / monitoring capacity (`worker` | `manager` | `supervisor`), separate from permission roles. */
  operational_role?: string | null;
  is_system_admin?: boolean;
  /** From `/auth/me`; effective module keys (permission matrix ∪ optional overlay ∪ extras); sidebar uses contract ∩ RBAC bridge. */
  enabled_features?: string[];
  /** From `/auth/me`; tenant contract module keys for all tenant users. */
  contract_features?: string[];
  /** From `/auth/me`; flat RBAC permission keys. */
  rbac_permissions?: string[];
  /** From `/auth/me`; coarse legacy permission strings (`module.*`). */
  permissions?: string[] | null;
  /** Deprecated: always empty from API. Hub access uses `rbac_permissions` + `contract_features` only. */
  department_workspace_slugs?: string[];
  /** Primary HR department slug from `/auth/me` for shell labels (not authorization). */
  hr_department?: string | null;
  /** From `/auth/me`; full tenant contract modules (company admin only). */
  contract_enabled_features?: string[] | null;
  /** From `/auth/me`; per-user module keys merged into RBAC (subset of contract). */
  feature_allow_extra?: string[] | null;
  /** From `/auth/me`; optional access overlay (additive modules + synced flat grants). */
  tenant_role_id?: string | null;
  /** From `/auth/me`; may open `/dashboard/workers`. */
  workers_roster_access?: boolean;
  /** True when a system administrator is viewing the app as this tenant user (JWT + `/auth/me`). */
  is_impersonating?: boolean;
  /** Tenant branding; absent for system_admin or legacy sessions. */
  company?: CompanySummary | null;
  /** User-level feature flag for advanced PM features in Projects. */
  can_use_pm_features?: boolean;
  /** In-facility tenant admin (sysadmin); base role remains in `roles`. */
  facility_tenant_admin?: boolean;
  /** Prefer over humanized `role` when present (e.g. ``Worker (Admin)``). */
  role_display_label?: string | null;
  /** From `/auth/me`; tenant workers with a temp password — UI prompts via header badge (not demo_viewer). */
  must_change_password?: boolean;
  iat: number;
  exp: number;
  /** Legacy: was tied to removed “Keep me signed in”; new sessions always use `false`. */
  remember: boolean;
};

export type UserOut = {
  id: string;
  email: string;
  company_id?: string | null;
  role: string;
  roles?: string[];
  full_name?: string | null;
  auth_provider?: "email" | "microsoft" | string;
  avatar_url?: string | null;
  job_title?: string | null;
  operational_role?: string | null;
  /** Effective module keys from `/auth/me` (matrix ∪ optional overlay ∪ extras). */
  enabled_features?: string[];
  contract_features?: string[];
  rbac_permissions?: string[];
  permissions?: string[] | null;
  /** Deprecated: always empty from API. Hub access uses `rbac_permissions` + `contract_features` only. */
  department_workspace_slugs?: string[];
  /** Primary HR department slug from `/auth/me` for shell labels (not authorization). */
  hr_department?: string | null;
  contract_enabled_features?: string[] | null;
  feature_allow_extra?: string[] | null;
  /** Optional access overlay (`tenant_roles.id`) — additive modules + synced grants. */
  tenant_role_id?: string | null;
  workers_roster_access?: boolean;
  is_impersonating?: boolean;
  is_system_admin?: boolean;
  company?: CompanySummary | null;
  can_use_pm_features?: boolean;
  facility_tenant_admin?: boolean;
  role_display_label?: string | null;
  /** True when the account is using a temporary default password. */
  must_change_password?: boolean;
  /** UTC ISO timestamp from `GET /auth/me` for client clock sync. */
  server_time?: string;
};

function emitAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("pulse-auth-change"));
}

/**
 * While true, API error surfaces should stay quiet: in-flight requests often complete with 401/403/404
 * right after `clearSession()`, which briefly showed confusing messages before the login route rendered.
 */
let pulseAuthTeardown = false;

export function isPulseAuthTeardown(): boolean {
  return pulseAuthTeardown;
}

export function endPulseAuthTeardown(): void {
  pulseAuthTeardown = false;
}

function beginPulseAuthTeardown(): void {
  pulseAuthTeardown = true;
}

function decodeJwtImpersonating(token: string | undefined): boolean | undefined {
  if (!token) return undefined;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64)) as { is_impersonating?: boolean };
    return typeof payload.is_impersonating === "boolean" ? payload.is_impersonating : undefined;
  } catch {
    return undefined;
  }
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
      clearSession();
      if (!isPulsePublicPath(window.location.pathname)) {
        navigateToPulseLogin();
      }
      return null;
    }
    return data;
  } catch {
    clearSession();
    if (!isPulsePublicPath(window.location.pathname)) {
      navigateToPulseLogin();
    }
    return null;
  }
}

function clearSessionQuiet() {
  if (typeof window === "undefined") return;
  setImpersonationOverlayAccessToken(null);
  localStorage.removeItem(PULSE_AUTH_STORAGE_KEY);
  try {
    localStorage.removeItem("pulse_auth_v1");
  } catch {
    /* ignore */
  }
  document.cookie = "pulse_session=; path=/; max-age=0; SameSite=Lax";
  try {
    sessionStorage.removeItem(PULSE_WELCOME_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  beginPulseAuthTeardown();
  clearSessionQuiet();
  emitAuthChange();
}

export function isLoggedIn(): boolean {
  return readSession() !== null;
}

/** True when this JWT session may call `/api/v1/pulse/*` (tenant users only; system admin must impersonate). */
export function canAccessPulseTenantApis(session: PulseAuthSession | null): boolean {
  if (getImpersonationOverlayAccessToken()) return true;
  if (!session?.access_token) return false;
  if (session.is_system_admin === true || session.role === "system_admin") return false;
  const cid = session.company_id;
  return cid != null && String(cid).length > 0;
}

export function writeSession(email: string, remember: boolean) {
  if (typeof window === "undefined") return;
  endPulseAuthTeardown();
  const now = Math.floor(Date.now() / 1000);
  const ttlSec = SESSION_FALLBACK_TTL_SEC;
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
  endPulseAuthTeardown();
  const jwtExp = decodeJwtExp(accessToken);
  const now = Math.floor(Date.now() / 1000);
  const exp = jwtExp ?? now + SESSION_FALLBACK_TTL_SEC;
  const payload: PulseAuthSession = {
    access_token: accessToken,
    sub: user.id,
    email: user.email,
    role: user.role,
    roles: user.roles?.length ? user.roles : user.role ? [user.role] : undefined,
    company_id: user.company_id ?? null,
    full_name: user.full_name ?? null,
    auth_provider: user.auth_provider ?? "email",
    avatar_url: user.avatar_url ?? null,
    job_title: user.job_title ?? null,
    operational_role: user.operational_role ?? null,
    is_system_admin: user.is_system_admin,
    enabled_features: user.enabled_features,
    contract_features: user.contract_features ?? undefined,
    rbac_permissions: user.rbac_permissions ?? undefined,
    permissions: user.permissions ?? undefined,
    department_workspace_slugs: user.department_workspace_slugs ?? undefined,
    hr_department: user.hr_department ?? undefined,
    contract_enabled_features: user.contract_enabled_features ?? undefined,
    feature_allow_extra: user.feature_allow_extra ?? undefined,
    tenant_role_id: user.tenant_role_id ?? undefined,
    workers_roster_access: user.workers_roster_access,
    is_impersonating:
      user.is_impersonating === false
        ? false
        : user.is_impersonating === true || decodeJwtImpersonating(accessToken) === true,
    company: user.company ?? null,
    can_use_pm_features: user.can_use_pm_features,
    facility_tenant_admin: user.facility_tenant_admin,
    role_display_label: user.role_display_label ?? undefined,
    must_change_password:
      user.must_change_password === true &&
      user.role !== "demo_viewer" &&
      !user.roles?.includes("demo_viewer")
        ? true
        : undefined,
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
  const loginText = await loginRes.text();
  if (!loginRes.ok) {
    return { ok: false, reason: "invalid_credentials" };
  }
  let tokenJson: TokenResponse;
  try {
    tokenJson = JSON.parse(loginText) as TokenResponse;
  } catch {
    return { ok: false, reason: "api_config" };
  }
  const token = tokenJson.access_token;
  const meRes = await fetch(`${base}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meText = await meRes.text();
  if (!meRes.ok) {
    return { ok: false, reason: "invalid_credentials" };
  }
  let user: UserOut;
  try {
    user = JSON.parse(meText) as UserOut;
  } catch {
    return { ok: false, reason: "api_config" };
  }
  applyServerTimeFromUserOut(user);
  return { ok: true, token, user };
}
