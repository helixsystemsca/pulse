/**
 * Client auth session mode — must match backend `AUTH_SESSION_MODE` when enabled.
 * Default `bearer` preserves legacy localStorage-only JWT behavior.
 */

export type AuthSessionMode = "bearer" | "dual" | "cookie";

export function readAuthSessionMode(): AuthSessionMode {
  const raw = (process.env.NEXT_PUBLIC_AUTH_SESSION_MODE ?? "bearer").trim().toLowerCase();
  if (raw === "dual" || raw === "cookie") return raw;
  return "bearer";
}

export function isDualAuthSessionMode(): boolean {
  return readAuthSessionMode() === "dual";
}

export function isRefreshTokenEnabled(): boolean {
  const mode = readAuthSessionMode();
  return mode === "dual" || mode === "cookie";
}
