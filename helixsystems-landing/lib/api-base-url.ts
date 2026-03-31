/**
 * NEXT_PUBLIC_API_URL must be the API origin only (e.g. https://api.example.com).
 * If env mistakenly includes /api or /api/v1, strip it so paths like /api/system/* and /api/v1/auth/* resolve correctly.
 */
export function normalizeApiBaseUrl(raw: string | undefined | null): string {
  let s = (raw ?? "").trim().replace(/\/+$/, "");
  if (!s) return "";
  s = s.replace(/\/api\/v1$/i, "");
  s = s.replace(/\/api$/i, "");
  return s;
}
