"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PULSE_ONBOARDING_BANNER_SESSION_KEY } from "@/lib/pulse-session";
import { useOnboarding } from "./OnboardingProvider";

export function OnboardingReminderBanner() {
  const { state, loading, active, setChecklistExpanded } = useOnboarding();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(PULSE_ONBOARDING_BANNER_SESSION_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (loading || !active || !state || dismissed) return null;

  const { completed_count, total_count, flow } = state;
  const isWorker = flow === "worker";

  return (
    <div className="pointer-events-auto fixed left-1/2 top-[4.25rem] z-[120] w-[min(92vw,44rem)] -translate-x-1/2 px-2 sm:top-16">
      <div className="flex items-center gap-3 rounded-md border border-slate-200/90 bg-white px-4 py-3 text-sm text-pulse-navy shadow-md backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
        <p className="min-w-0 flex-1 leading-snug dark:text-slate-200">
          {isWorker ? (
            <>
              Complete your setup to start working efficiently ({completed_count}/{total_count} required done).
            </>
          ) : (
            <>Finish core setup for a live-feeling workspace ({completed_count}/{total_count} required done).</>
          )}
        </p>
        <button
          type="button"
          className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-[#3B82F6] dark:hover:brightness-110"
          onClick={() => setChecklistExpanded(true)}
        >
          Open checklist
        </button>
        {isWorker ? (
          <Link
            href="/dashboard/maintenance/work-requests"
            className="hidden shrink-0 text-xs font-semibold text-[#2B4C7E] underline decoration-slate-300 underline-offset-2 dark:text-sky-300 dark:decoration-sky-500/50 sm:inline"
          >
            Issues
          </Link>
        ) : (
          <Link
            href="/dashboard/setup?tab=zones"
            className="hidden shrink-0 text-xs font-semibold text-[#2B4C7E] underline decoration-slate-300 underline-offset-2 dark:text-sky-300 dark:decoration-sky-500/50 sm:inline"
          >
            Setup
          </Link>
        )}
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-pulse-muted hover:bg-slate-100 hover:text-pulse-navy dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Dismiss reminder"
          onClick={() => {
            try {
              sessionStorage.setItem(PULSE_ONBOARDING_BANNER_SESSION_KEY, "1");
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
