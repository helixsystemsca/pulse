"use client";

import { useOnboarding } from "./OnboardingProvider";
import { NonAdminOnboardingModal } from "./NonAdminOnboardingModal";
import { OnboardingReminderBanner } from "./OnboardingReminderBanner";

/**
 * Fixed-position onboarding UI: non-admin welcome tour modal, setup reminder banner (company admins), toast.
 * The org checklist card lives on the operations dashboard (`AdminOnboardingChecklist`).
 */
export function OnboardingChrome() {
  const { active, toastMessage, dismissToast } = useOnboarding();

  return (
    <>
      <NonAdminOnboardingModal />
      {active ? <OnboardingReminderBanner /> : null}
      {toastMessage ? (
        <div className="pointer-events-auto fixed bottom-24 left-1/2 z-[125] w-[min(92vw,24rem)] -translate-x-1/2 px-2 sm:bottom-28">
          <div className="flex items-center gap-3 rounded-md border border-slate-200/90 bg-white px-4 py-3 text-sm font-medium text-pulse-navy shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
            <p className="min-w-0 flex-1 leading-snug">{toastMessage}</p>
            <button
              type="button"
              onClick={dismissToast}
              className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-pulse-navy hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
