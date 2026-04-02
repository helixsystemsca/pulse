/**
 * Hostnames that serve the Pulse app directly (e.g. `/` → `/login`), without the marketing shell.
 * Keep in sync with `middleware.ts` and `PULSE_APP_HOSTNAMES` (comma-separated).
 */

const DEFAULT_PULSE_APP_HOSTS = ["pulse.helixsystems.ca"];

export function getPulseAppHostnameSet(): Set<string> {
  const raw = process.env.PULSE_APP_HOSTNAMES?.trim();
  const parts = raw
    ? raw.split(",").map((h) => h.trim().toLowerCase())
    : DEFAULT_PULSE_APP_HOSTS;
  return new Set(parts.filter(Boolean));
}

export function requestHostnameFromHeaders(getHeader: (name: string) => string | null): string {
  const forwarded = getHeader("x-forwarded-host");
  if (forwarded) {
    return forwarded.split(",")[0].trim().toLowerCase().split(":")[0];
  }
  const host = getHeader("host");
  return (host ?? "").toLowerCase().split(":")[0];
}

export function isPulseAppHost(hostname: string): boolean {
  if (!hostname) return false;
  return getPulseAppHostnameSet().has(hostname);
}
