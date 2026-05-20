/** Kiosk display defaults — presentation layer. */

export const KIOSK_AUTO_REFRESH_MS = 5 * 60 * 1000;

export const KIOSK_PRESENTATION_CLASS = "kiosk-display";

export function kioskRefreshIntervalMs(): number {
  if (typeof window === "undefined") return KIOSK_AUTO_REFRESH_MS;
  try {
    const raw = localStorage.getItem("pulse.kiosk.refresh_ms");
    if (!raw) return KIOSK_AUTO_REFRESH_MS;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 60_000 ? n : KIOSK_AUTO_REFRESH_MS;
  } catch {
    return KIOSK_AUTO_REFRESH_MS;
  }
}
