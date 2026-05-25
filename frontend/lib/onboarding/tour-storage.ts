/** Per-tab tour completion (see docs/onboarding/INTEGRATION_GUIDE.md). */
export const TOUR_COMPLETED_KEY = "panorama-rec-tour-completed";
export const TOUR_DISMISSED_KEY = "panorama-rec-tour-dismissed";

export function isTourCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(TOUR_COMPLETED_KEY) === "true";
  } catch {
    return true;
  }
}

export function markTourCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
  } catch {
    /* ignore */
  }
}

export function clearTourCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    localStorage.removeItem(TOUR_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
}
