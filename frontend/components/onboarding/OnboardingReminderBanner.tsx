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

  const { completed_count, total_count } = state;

  return (
    <div className="pointer-events-auto fixed left-1/2 top-[4.25rem] z-[120] w-[min(92vw,44rem)] -translate-x-1/2 px-2 sm:top-16">
      <div className="flex items-center gap-3 rounded-md border border-ds-border bg-ds-elevated px-4 py-3 text-sm text-ds-foreground shadow-[var(--ds-shadow-card)] backdrop-blur-sm">
        <p className="min-w-0 flex-1 leading-snug text-ds-foreground">
          Finish organization setup ({completed_count}/{total_count} completed). Open your dashboard checklist for quick
          links.
        </p>
        <button
          type="button"
          className="ds-btn-solid-primary shrink-0 px-3 py-1.5 text-xs"
          onClick={() => setChecklistExpanded(true)}
        >
          Open checklist
        </button>
        <Link
          href="/overview#admin-onboarding-checklist"
          className="hidden shrink-0 text-xs font-semibold text-ds-success underline decoration-ds-border underline-offset-2 sm:inline"
        >
          Dashboard
        </Link>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-pulse-muted hover:bg-slate-100 hover:text-pulse-navy dark:text-slate-400 dark:hover:bg-ds-interactive-hover dark:hover:text-slate-100"
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
