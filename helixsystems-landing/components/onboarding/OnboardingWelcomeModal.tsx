"use client";

import { useEffect, useState } from "react";
import { PULSE_ONBOARDING_INTRO_SESSION_KEY } from "@/lib/pulse-session";
import { patchOnboarding } from "@/lib/onboardingService";
import { refreshPulseUserFromServer } from "@/lib/api";
import { useOnboarding } from "./OnboardingProvider";

type Props = {
  /** After delay on /overview so the welcome overlay can finish first */
  canShow: boolean;
};

export function OnboardingWelcomeModal({ canShow }: Props) {
  const { state, loading, reload, setChecklistExpanded, active } = useOnboarding();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!canShow || loading || !active || !state) {
      setOpen(false);
      return;
    }
    try {
      if (sessionStorage.getItem(PULSE_ONBOARDING_INTRO_SESSION_KEY) === "1") {
        setOpen(false);
        return;
      }
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, [canShow, loading, active, state]);

  if (!open || !state) return null;

  function dismissSession() {
    try {
      sessionStorage.setItem(PULSE_ONBOARDING_INTRO_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  async function onDontShowAgain() {
    try {
      await patchOnboarding({ onboarding_enabled: false });
      await refreshPulseUserFromServer();
      await reload();
    } catch {
      /* ignore */
    }
    dismissSession();
  }

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-intro-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => dismissSession()}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl">
        <h2 id="onboarding-intro-title" className="font-headline text-xl font-bold text-pulse-navy">
          Get Started in 2 Minutes
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-pulse-muted">
          Follow the guided checklist to set up your facility and start tracking operations.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            className="order-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-pulse-muted hover:bg-slate-50 sm:order-1"
            onClick={() => void onDontShowAgain()}
          >
            Don&apos;t show again
          </button>
          <button
            type="button"
            className="order-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-pulse-navy hover:bg-slate-50"
            onClick={() => dismissSession()}
          >
            Skip for now
          </button>
          <button
            type="button"
            className="order-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 sm:order-3"
            onClick={() => {
              setChecklistExpanded(true);
              dismissSession();
            }}
          >
            Start Setup
          </button>
        </div>
      </div>
    </div>
  );
}
