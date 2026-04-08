import { refreshPulseUserFromServer } from "@/lib/api";
import { patchOnboarding } from "@/lib/onboardingService";

/** Fired after actions that may advance onboarding server-side; `OnboardingProvider` refetches state. */
export const PULSE_ONBOARDING_UPDATED_EVENT = "pulse-onboarding-maybe-updated";

/** Fired when facility data used by the dashboard setup checklist may have changed. */
export const PULSE_SETUP_PROGRESS_UPDATED_EVENT = "pulse-setup-progress-updated";

/** Re-open the non-admin onboarding modal (e.g. Help / Settings replay). */
export const PULSE_OPEN_ONBOARDING_TOUR_EVENT = "pulse-open-onboarding-tour";

export function emitOnboardingMaybeUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PULSE_ONBOARDING_UPDATED_EVENT));
  window.dispatchEvent(new CustomEvent(PULSE_SETUP_PROGRESS_UPDATED_EVENT));
}

/** Reset non-admin tour and open the modal (Help / Settings). */
export async function replayNonAdminOnboardingTour(refreshSession: () => void): Promise<void> {
  try {
    await patchOnboarding({ user_onboarding_tour_completed: false });
    await refreshPulseUserFromServer();
    refreshSession();
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PULSE_OPEN_ONBOARDING_TOUR_EVENT));
  }
}
