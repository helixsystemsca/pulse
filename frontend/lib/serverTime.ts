/**
 * Client clock offset from the API server (UTC), applied from `/auth/me` `server_time`.
 * Use `getServerNow()` for “current instant” in scheduling and operations logic.
 * Do not use for parsing stored ISO timestamps from the API (those stay UTC; display with `new Date(iso)`).
 */

let serverOffsetMs = 0;

/** Apply offset from an ISO-8601 UTC timestamp returned by the server. */
export function applyServerTimeFromIso(iso: string | null | undefined): void {
  if (iso == null || typeof iso !== "string" || !iso.trim()) return;
  const serverMs = Date.parse(iso);
  if (Number.isNaN(serverMs)) return;
  serverOffsetMs = serverMs - Date.now();
}

export function applyServerTimeFromUserOut(user: { server_time?: string | null }): void {
  applyServerTimeFromIso(user.server_time ?? undefined);
}

/** Milliseconds since Unix epoch, aligned to server time when offset has been synced. */
export function getServerNow(): number {
  if (typeof window === "undefined") {
    return Date.now();
  }
  return Date.now() + serverOffsetMs;
}

/** `Date` for the current server-aligned instant (local timezone display unchanged). */
export function getServerDate(): Date {
  return new Date(getServerNow());
}
