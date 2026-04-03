/** Fired after actions that may advance onboarding server-side; `OnboardingProvider` refetches state. */
export const PULSE_ONBOARDING_UPDATED_EVENT = "pulse-onboarding-maybe-updated";

export function emitOnboardingMaybeUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PULSE_ONBOARDING_UPDATED_EVENT));
}
