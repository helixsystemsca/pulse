import { getApiBaseUrl, resolveApiUrl } from "@/lib/api/client";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

/**
 * Loads a tenant-only image URL (e.g. `/api/v1/company/logo`) with the bearer token and returns a
 * `data:` URI. React Native's `Image` often fails or shows a grey box with `{ uri, headers }`; this path is reliable.
 */
export async function fetchAuthenticatedImageAsDataUri(rawPathOrUrl: string, token: string): Promise<string | null> {
  const s = rawPathOrUrl.trim();
  if (!s || !token) return null;
  if (/^https?:\/\//i.test(s)) {
    return s;
  }
  if (!getApiBaseUrl()) return null;
  const absolute = resolveApiUrl(s);
  if (!absolute) return null;
  const res = await fetch(absolute, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const ct = (res.headers.get("content-type") || "image/png").split(";")[0]!.trim();
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) return null;
  const b64 = arrayBufferToBase64(buf);
  return `data:${ct};base64,${b64}`;
}
