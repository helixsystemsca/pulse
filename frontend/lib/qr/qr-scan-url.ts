/** Path segment `/qr/{token}` from an API value or absolute URL. */
export function qrScanPath(qrUrl: string): string | null {
  const trimmed = qrUrl.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/qr\/[A-Za-z0-9]+/);
  return match ? match[0] : null;
}

/** Absolute URL encoded in printed QR images (phones cannot open path-only links). */
export function qrScanUrl(qrUrl: string): string {
  const trimmed = qrUrl.trim();
  if (!trimmed) return trimmed;

  const path = qrScanPath(trimmed) ?? (trimmed.startsWith("/") ? trimmed : null);
  if (path && typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed;
}

/** Same-origin scan entry (use in links instead of pulseAppHref). */
export function qrScanHref(qrUrlOrToken: string): string {
  const raw = qrUrlOrToken.trim();
  const path = qrScanPath(raw) ?? (/^\/qr\//.test(raw) ? raw : `/qr/${raw}`);
  return path;
}
