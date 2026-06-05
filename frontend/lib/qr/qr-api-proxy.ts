import { normalizeApiBaseUrl } from "@/lib/api-base-url";

export function qrResolveApiBase(): string | null {
  const base = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  return base || null;
}

export function buildQrResolveUpstreamUrl(
  token: string,
  opts?: { guest?: boolean; authenticated?: boolean },
): string | null {
  const base = qrResolveApiBase();
  if (!base) return null;
  const enc = encodeURIComponent(token);
  const qs = opts?.guest ? "?guest=1" : "";
  const prefix = opts?.authenticated ? "/api/qr/resolve" : "/api/public/qr/resolve";
  return `${base}${prefix}/${enc}${qs}`;
}
