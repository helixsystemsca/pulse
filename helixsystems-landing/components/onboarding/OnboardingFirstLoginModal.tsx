"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isApiMode, refreshPulseUserFromServer } from "@/lib/api";
import { patchOnboarding } from "@/lib/onboardingService";
import { canAccessPulseTenantApis } from "@/lib/pulse-session";
import { usePulseAuth } from "@/hooks/usePulseAuth";

/**
 * Non-blocking first-login intro. Shown only when `user.onboarding_seen === false` on the server.
 * Any dismiss sets `onboarding_seen` true — never uses sessionStorage.
 */
export function OnboardingFirstLoginModal() {
  const router = useRouter();
  const { session, refresh } = usePulseAuth();
  const [open, setOpen] = useState(false);

  const eligible =
    isApiMode() &&
    session &&
    canAccessPulseTenantApis(session) &&
    session.onboarding_seen === false;

  useEffect(() => {
    setOpen(Boolean(eligible));
  }, [eligible]);

  const markSeen = useCallback(async () => {
    try {
      await patchOnboarding({ onboarding_seen: true });
      await refreshPulseUserFromServer();
      refresh();
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, [refresh]);

  const onStartSetup = () => {
    void (async () => {
      await markSeen();
      router.push("/overview#facility-setup-checklist");
    })();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-login-onboarding-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => void markSeen()}
      />
      <div className="relative w-full max-w-md rounded-md border border-slate-200/90 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-900">
        <h2 id="first-login-onboarding-title" className="font-headline text-xl font-bold text-pulse-navy dark:text-slate-100">
          Welcome to Helix Pulse
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-pulse-muted dark:text-slate-400">
          This workspace ties together your floor plan, zones, equipment, team, and procedures. You can explore
          freely — nothing here is required before using the app.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-pulse-muted dark:text-slate-400">
          When you are ready, a practical order is: facility layout → zones → equipment → workers → first procedure.
          Your dashboard includes a checklist that tracks progress and links straight into each area.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            className="order-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-pulse-navy hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80"
            onClick={() => void markSeen()}
          >
            Skip for now
          </button>
          <button
            type="button"
            className="order-1 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-[#3B82F6] dark:hover:brightness-110 sm:order-3"
            onClick={onStartSetup}
          >
            Start Setup Guide
          </button>
        </div>
      </div>
    </div>
  );
}
