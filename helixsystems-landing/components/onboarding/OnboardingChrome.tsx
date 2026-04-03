"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useOnboarding } from "./OnboardingProvider";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { OnboardingReminderBanner } from "./OnboardingReminderBanner";
import { OnboardingWelcomeModal } from "./OnboardingWelcomeModal";

/**
 * Fixed-position onboarding UI: intro modal, reminder banner, collapsible checklist, toast.
 */
export function OnboardingChrome() {
  const pathname = usePathname();
  const { active, toastMessage, dismissToast } = useOnboarding();
  const [introGate, setIntroGate] = useState(false);

  useEffect(() => {
    if (!active) {
      setIntroGate(false);
      return;
    }
    if (pathname === "/overview") {
      const t = window.setTimeout(() => setIntroGate(true), 4500);
      return () => window.clearTimeout(t);
    }
    setIntroGate(true);
    return undefined;
  }, [pathname, active]);

  return (
    <>
      {active ? <OnboardingWelcomeModal canShow={introGate} /> : null}
      {active ? <OnboardingReminderBanner /> : null}
      {active ? <OnboardingChecklist /> : null}
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
