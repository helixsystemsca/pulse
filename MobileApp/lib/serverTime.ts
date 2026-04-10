/**
 * Align client "now" with API server time from `/api/v1/auth/me` `server_time` (same idea as web `serverTime.ts`).
 */

let serverOffsetMs = 0;

export function applyServerTimeFromIso(iso: string | null | undefined): void {
  if (iso == null || typeof iso !== "string" || !iso.trim()) return;
  const serverMs = Date.parse(iso);
  if (Number.isNaN(serverMs)) return;
  serverOffsetMs = serverMs - Date.now();
}

/** Use for shift active-window checks so mobile matches the operations dashboard. */
export function getServerAlignedNow(): number {
  return Date.now() + serverOffsetMs;
}
