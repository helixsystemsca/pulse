/** Absolute URL encoded in printed QR images (phones cannot open path-only links). */
export function qrScanUrl(qrUrl: string): string {
  const trimmed = qrUrl.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
  }
  return trimmed;
}
