/** Safe post-login return paths for QR deep links and other product routes. */

const LOGIN_RETURN_TO_KEY = "pulse_login_return_to";

export function isSafePulseReturnPath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false;
  if (value.startsWith("/login") || value.startsWith("/auth/callback")) return false;
  if (typeof window === "undefined") return true;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function returnToFromLoginUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  for (const key of ["next", "returnTo", "redirectTo"]) {
    const value = params.get(key);
    if (isSafePulseReturnPath(value)) return value;
  }
  return null;
}

export function storeLoginReturnTo(path: string): void {
  if (typeof window === "undefined" || !isSafePulseReturnPath(path)) return;
  try {
    window.sessionStorage.setItem(LOGIN_RETURN_TO_KEY, path);
  } catch {
    /* optional */
  }
}

export function consumeLoginReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(LOGIN_RETURN_TO_KEY);
    window.sessionStorage.removeItem(LOGIN_RETURN_TO_KEY);
    return isSafePulseReturnPath(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function loginHrefWithReturnTo(returnTo: string): string {
  if (!isSafePulseReturnPath(returnTo)) return "/login";
  return `/login?next=${encodeURIComponent(returnTo)}`;
}
