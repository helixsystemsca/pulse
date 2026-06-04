import { isPulseAuthTeardown } from "@/lib/pulse-session";

/**
 * Normalizes errors thrown by `apiFetch` (or fetch failures) into a message suitable for UI banners.
 * Keeps HTTP status and request URL when present for debugging user-reported issues.
 */
export function parseClientApiError(err: unknown): {
  message: string;
  status?: number;
  requestUrl?: string;
} {
  if (typeof window !== "undefined" && isPulseAuthTeardown()) {
    return { message: "" };
  }
  let msg = "Request failed";
  let status: number | undefined;
  let requestUrl: string | undefined;
  if (err && typeof err === "object") {
    if ("status" in err && typeof (err as { status: unknown }).status === "number") {
      status = (err as { status: number }).status;
    }
    if ("requestUrl" in err && typeof (err as { requestUrl: unknown }).requestUrl === "string") {
      requestUrl = (err as { requestUrl: string }).requestUrl;
    }
    if ("body" in err) {
      const body = (err as { body?: { detail?: unknown } }).body;
      const d = body?.detail;
      if (typeof d === "string") msg = d;
      else if (Array.isArray(d) && d[0] && typeof d[0] === "object" && "msg" in d[0]) {
        msg = String((d[0] as { msg: unknown }).msg);
      }
    }
  }
  if (err instanceof Error && msg === "Request failed") {
    msg = err.message;
  }
  if (
    status === undefined &&
    err instanceof TypeError &&
    /fetch|failed to fetch|networkerror|load failed/i.test(String(err.message))
  ) {
    msg =
      "The browser could not read the API response (connection failed or the server returned an error without CORS headers). Sign out and sign in again after permission changes, then check DevTools → Network for the real status (401, 403, 422, 500, or “failed”).";
  }
  return { message: msg, status, requestUrl };
}
