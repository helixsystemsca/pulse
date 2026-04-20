/**
 * Login identifier rules aligned with `frontend/lib/pulse-session.ts` so the same
 * accounts work on web and Expo when env vars match.
 */

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

/** When `EXPO_PUBLIC_PULSE_LOGIN_EMAIL_DOMAIN` is set, "jsmith" → "jsmith@domain" (mirror web `NEXT_PUBLIC_PULSE_LOGIN_EMAIL_DOMAIN`). */
export function expandLoginEmail(identifier: string): string {
  const t = identifier.trim();
  if (t.includes("@")) return t.toLowerCase();
  const domain = process.env.EXPO_PUBLIC_PULSE_LOGIN_EMAIL_DOMAIN?.trim();
  if (domain) return `${t}@${domain}`.toLowerCase();
  return t.toLowerCase();
}
