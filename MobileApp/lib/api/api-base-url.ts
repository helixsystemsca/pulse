/**
 * Same rules as web `normalizeApiBaseUrl`: API origin only, no trailing `/api` or `/api/v1`.
 * So `EXPO_PUBLIC_API_BASE_URL` can match `NEXT_PUBLIC_API_URL` from the Pulse frontend.
 */
export function normalizeApiBaseUrl(raw: string | undefined | null): string {
  let s = (raw ?? "").trim().replace(/\/+$/, "");
  if (!s) return "";
  s = s.replace(/\/api\/v1$/i, "");
  s = s.replace(/\/api$/i, "");
  return s;
}
