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
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] dark:bg-black/55 dark:backdrop-blur-sm"
        aria-label="Close"
        onClick={() => void markSeen()}
      />
      <div className="relative w-full max-w-md rounded-lg border border-[var(--pulse-shell-border)] bg-[var(--pulse-shell-surface)] p-6 shadow-[var(--pulse-shell-shadow)]">
        <h2
          id="first-login-onboarding-title"
          className="font-headline text-xl font-bold text-gray-900 dark:text-gray-100"
        >
          Welcome to Helix Pulse
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Pulse connects zones, devices, monitoring, your team, and maintenance. Explore in any order — core steps are
          suggestions, not gatekeepers.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Fastest path to something meaningful: define zones → add or simulate devices → open Monitoring → optionally
          invite workers → create a work order or procedure. Your checklist tracks progress with direct links (and you
          can use demo sensor data if hardware is not ready yet).
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            className="order-2 rounded-md border border-[var(--pulse-shell-border)] bg-[var(--pulse-shell-elevated)] px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-[var(--pulse-shell-cell-muted)] dark:text-gray-100 dark:hover:brightness-110"
            onClick={() => void markSeen()}
          >
            Skip for now
          </button>
          <button
            type="button"
            className="order-1 rounded-md bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1e293b] dark:bg-blue-600 dark:hover:bg-blue-500 sm:order-3"
            onClick={onStartSetup}
          >
            Start Setup Guide
          </button>
        </div>
      </div>
    </div>
  );
}
