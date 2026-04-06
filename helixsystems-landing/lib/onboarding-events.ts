/** Fired after actions that may advance onboarding server-side; `OnboardingProvider` refetches state. */
export const PULSE_ONBOARDING_UPDATED_EVENT = "pulse-onboarding-maybe-updated";

/** Fired when facility data used by the dashboard setup checklist may have changed. */
export const PULSE_SETUP_PROGRESS_UPDATED_EVENT = "pulse-setup-progress-updated";

export function emitOnboardingMaybeUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PULSE_ONBOARDING_UPDATED_EVENT));
  window.dispatchEvent(new CustomEvent(PULSE_SETUP_PROGRESS_UPDATED_EVENT));
}
