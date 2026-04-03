"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useOnboarding } from "./OnboardingProvider";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { OnboardingReminderBanner } from "./OnboardingReminderBanner";
import { OnboardingWelcomeModal } from "./OnboardingWelcomeModal";

/**
 * Fixed-position onboarding UI: intro modal, reminder banner, collapsible checklist.
 * Rendered outside `MainContentWidth` so it does not affect dashboard layout.
 */
export function OnboardingChrome() {
  const pathname = usePathname();
  const { active } = useOnboarding();
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

  if (!active) return null;

  return (
    <>
      <OnboardingWelcomeModal canShow={introGate} />
      <OnboardingReminderBanner />
      <OnboardingChecklist />
    </>
  );
}
