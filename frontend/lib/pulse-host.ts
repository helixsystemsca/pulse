/**
 * Hostnames that serve the Pulse app directly (e.g. `/` → `/login`), without the marketing shell.
 * Keep in sync with `middleware.ts`.
 *
 * Default product host is `vernon.helixsystems.ca`. Legacy panorama/pulse/ops/pps hosts stay in the
 * list so existing bookmarks keep working until operators remove them from DNS.
 *
 * - Set `PULSE_APP_HOSTNAMES` (comma-separated) to override this list entirely.
 * - If unset, defaults include vernon plus legacy hosts, and the host from
 *   `NEXT_PUBLIC_PULSE_APP_URL` so a single env update keeps middleware + login layout aligned.
 */

const DEFAULT_PULSE_APP_HOSTS = [
  "vernon.helixsystems.ca",
  "panorama.helixsystems.ca",
  "pulse.helixsystems.ca",
  "ops.helixsystems.ca",
  "pps.helixsystems.ca",
];

function hostnameFromPulseAppUrl(): string | null {
  if (typeof process === "undefined") return null;
  const raw = process.env.NEXT_PUBLIC_PULSE_APP_URL?.trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    return u.hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export function getPulseAppHostnameSet(): Set<string> {
  const explicit = process.env.PULSE_APP_HOSTNAMES?.trim();
  const out = new Set<string>();
  if (explicit) {
    for (const p of explicit.split(",")) {
      const h = p.trim().toLowerCase();
      if (h) out.add(h);
    }
    return out;
  }
  for (const h of DEFAULT_PULSE_APP_HOSTS) {
    if (h) out.add(h);
  }
  const fromUrl = hostnameFromPulseAppUrl();
  if (fromUrl) out.add(fromUrl);
  return out;
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
