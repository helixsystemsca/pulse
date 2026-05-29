import { apiFetch, isApiMode } from "@/lib/api";
import {
  clearTourCompleted,
  isTourCompleted,
  markTourCompleted,
  readCompletedMapForSync,
  writeCompletedMap,
} from "@/lib/onboarding/tour-storage";

export const DASHBOARD_OVERVIEW_TOUR_ID = "dashboard-overview";

type OnboardingToursPayload = { completed: Record<string, boolean> };

let serverCompleted: Record<string, boolean> | null = null;

/** When set, tour completion reads from the server map (cross-browser source of truth). */
export function applyServerOnboardingTours(completed: Record<string, boolean>): void {
  serverCompleted = { ...completed };
  const local = readCompletedMapForSync();
  let changed = false;
  for (const id of Object.keys(local)) {
    if (completed[id] !== true) {
      delete local[id];
      changed = true;
    }
  }
  if (changed) writeCompletedMap(local);
}

export function isTourCompletedMerged(tourId: string): boolean {
  if (serverCompleted !== null) return serverCompleted[tourId] === true;
  return isTourCompleted(tourId);
}

export function markTourCompletedMerged(tourId: string): void {
  markTourCompleted(tourId);
  if (serverCompleted !== null) serverCompleted[tourId] = true;
  if (isApiMode()) {
    void apiFetch<OnboardingToursPayload>("/api/v1/profile/onboarding-tours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tour_id: tourId, completed: true }),
    }).catch(() => {
      /* offline — local still updated */
    });
  }
}

export function clearTourCompletedMerged(tourId: string): void {
  clearTourCompleted(tourId);
  if (serverCompleted !== null) delete serverCompleted[tourId];
}

export async function loadOnboardingToursFromServer(): Promise<void> {
  if (!isApiMode()) return;
  try {
    const remote = await apiFetch<OnboardingToursPayload>("/api/v1/profile/onboarding-tours");
    applyServerOnboardingTours(remote?.completed ?? {});
  } catch {
    /* keep local-only */
  }
}
