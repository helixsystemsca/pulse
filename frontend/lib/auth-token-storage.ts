/**
 * Refresh token storage (sessionStorage) — isolated to avoid import cycles with pulse-session.
 */

export const PULSE_REFRESH_STORAGE_KEY = "pulse_refresh_v1";

export function readStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PULSE_REFRESH_STORAGE_KEY);
    return raw && raw.length >= 32 ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredRefreshToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PULSE_REFRESH_STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearStoredRefreshToken(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PULSE_REFRESH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
