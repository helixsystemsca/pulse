/** Kiosk display defaults — presentation layer. */

export const KIOSK_AUTO_REFRESH_MS = 5 * 60 * 1000;

/** How long each viewport page stays on a wall display before advancing. */
export const KIOSK_PAGE_DWELL_MS = 15_000;

export const KIOSK_PRESENTATION_CLASS = "kiosk-display";

const PAGE_FIT_EPSILON_PX = 16;
const PAGE_OVERLAP_PX = 64;

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

export function kioskPageDwellMs(): number {
  if (typeof window === "undefined") return KIOSK_PAGE_DWELL_MS;
  try {
    const raw = localStorage.getItem("pulse.kiosk.page_ms");
    if (!raw) return KIOSK_PAGE_DWELL_MS;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 5_000 ? n : KIOSK_PAGE_DWELL_MS;
  } catch {
    return KIOSK_PAGE_DWELL_MS;
  }
}

/**
 * Viewport-height page offsets for a kiosk scroll container.
 * Overlaps slightly so widgets cut at the bottom reappear on the next page.
 */
export function kioskPageOffsets(
  scrollHeight: number,
  clientHeight: number,
  overlapPx = PAGE_OVERLAP_PX,
): number[] {
  if (clientHeight <= 0) return [0];
  if (scrollHeight <= clientHeight + PAGE_FIT_EPSILON_PX) return [0];

  const max = Math.max(0, scrollHeight - clientHeight);
  const step = Math.max(1, clientHeight - Math.max(0, overlapPx));
  const offsets: number[] = [];
  for (let y = 0; y < max; y += step) {
    offsets.push(Math.min(y, max));
  }
  if (offsets[offsets.length - 1] !== max) offsets.push(max);
  return offsets;
}
