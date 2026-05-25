/** Per-page tour completion (`docs/onboarding/INTEGRATION_GUIDE.md`). */
export const TOUR_COMPLETED_KEY = "panorama-rec-tour-completed";
export const TOURS_COMPLETED_MAP_KEY = "panorama-rec-tours-completed-v1";
export const TOUR_DISMISSED_KEY = "panorama-rec-tour-dismissed";

function readCompletedMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TOURS_COMPLETED_MAP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      if (parsed && typeof parsed === "object") return parsed;
    }
    if (localStorage.getItem(TOUR_COMPLETED_KEY) === "true") {
      return { "dashboard-overview": true, "dashboard-worker": true };
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeCompletedMap(map: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOURS_COMPLETED_MAP_KEY, JSON.stringify(map));
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
  } catch {
    /* ignore */
  }
}

export function isTourCompleted(tourId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return readCompletedMap()[tourId] === true;
  } catch {
    return true;
  }
}

export function markTourCompleted(tourId: string): void {
  if (typeof window === "undefined") return;
  const map = readCompletedMap();
  map[tourId] = true;
  writeCompletedMap(map);
}

/** Clear one tour or all tours (restart). */
export function clearTourCompleted(tourId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!tourId) {
      localStorage.removeItem(TOURS_COMPLETED_MAP_KEY);
      localStorage.removeItem(TOUR_COMPLETED_KEY);
      localStorage.removeItem(TOUR_DISMISSED_KEY);
      return;
    }
    const map = readCompletedMap();
    delete map[tourId];
    writeCompletedMap(map);
    if (Object.keys(map).length === 0) {
      localStorage.removeItem(TOUR_COMPLETED_KEY);
    }
  } catch {
    /* ignore */
  }
}
