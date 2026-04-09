import { apiFetch } from "./client";
import { getMe, type PulseMe } from "./pulse";

export type TokenResponse = {
  access_token: string;
  token_type?: string;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  roles: string[];
  permissions: string[];
  /** From `/auth/me`; relative paths need `resolveApiUrl` + bearer when loading in `Image`. */
  avatarUrl?: string | null;
};

/** Same database + JWT as the Pulse web app: `POST /api/v1/auth/login`. */
export async function loginWithPassword(email: string, password: string): Promise<string> {
  const norm = email.trim().toLowerCase();
  const res = await apiFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { email: norm, password },
  });
  const token = res.access_token?.trim();
  if (!token) throw new Error("No access token from server");
  return token;
}

export function pulseMeToSessionUser(me: PulseMe): SessionUser {
  return {
    id: me.id,
    email: me.email,
    fullName: (me.full_name ?? "").trim() || me.email,
    role: me.role,
    roles: me.roles ?? [],
    permissions: Array.isArray(me.permissions) ? me.permissions : me.permissions == null ? [] : [],
    avatarUrl: me.avatar_url ?? null,
  };
}

export async function loadSessionUser(token: string): Promise<SessionUser> {
  const me = await getMe(token);
  return pulseMeToSessionUser(me);
}
