"use client";

import { useOnboarding } from "./OnboardingProvider";
import { OnboardingFirstLoginModal } from "./OnboardingFirstLoginModal";
import { OnboardingReminderBanner } from "./OnboardingReminderBanner";

/**
 * Fixed-position onboarding UI: first-login intro (server `onboarding_seen`), reminder banner, toast.
 * The main setup checklist lives on the operations dashboard (`FacilitySetupChecklist`).
 */
export function OnboardingChrome() {
  const { active, toastMessage, dismissToast } = useOnboarding();

  return (
    <>
      <OnboardingFirstLoginModal />
      {active ? <OnboardingReminderBanner /> : null}
      {toastMessage ? (
        <div className="pointer-events-auto fixed bottom-24 left-1/2 z-[125] w-[min(92vw,24rem)] -translate-x-1/2 px-2 sm:bottom-28">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
            <p className="min-w-0 flex-1 leading-snug">{toastMessage}</p>
            <button
              type="button"
              onClick={dismissToast}
              className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
