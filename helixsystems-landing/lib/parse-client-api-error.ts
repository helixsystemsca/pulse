/**
 * Normalizes errors thrown by `apiFetch` (or fetch failures) into a message suitable for UI banners.
 * Keeps HTTP status and request URL when present for debugging user-reported issues.
 */
export function parseClientApiError(err: unknown): {
  message: string;
  status?: number;
  requestUrl?: string;
} {
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
  if (err instanceof TypeError && /fetch/i.test(String(err.message))) {
    msg =
      "Could not reach the API (network or CORS). On the API host, set CORS_ORIGINS (and CORS_EXTRA_ORIGINS if needed) so this site’s origin is allowed—e.g. https://pulse.helixsystems.ca and https://www.helixsystems.ca—then redeploy.";
  }
  return { message: msg, status, requestUrl };
}
