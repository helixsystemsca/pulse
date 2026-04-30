"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isApiMode, refreshPulseUserFromServer } from "@/lib/api";
import { PULSE_OPEN_ONBOARDING_TOUR_EVENT } from "@/lib/onboarding-events";
import { patchOnboarding } from "@/lib/onboardingService";
import { canAccessPulseTenantApis } from "@/lib/pulse-session";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { useGuidedTour, type GuidedTourStep } from "./CoreGuidedTour";

async function completeTour(refresh: () => void) {
  try {
    await patchOnboarding({ user_onboarding_tour_completed: true });
    await refreshPulseUserFromServer();
    refresh();
  } catch {
    /* ignore */
  }
}

/**
 * Short skippable tour for non-company-admin tenant roles. Company admins use the dashboard checklist instead.
 */
export function NonAdminOnboardingModal() {
  const router = useRouter();
  const { session, refresh } = usePulseAuth();
  const [open, setOpen] = useState(false);
  const { startTour } = useGuidedTour();

  const isAdmin = Boolean(session && sessionHasAnyRole(session, "company_admin"));
  const tourDone = Boolean(session?.user_onboarding_tour_completed);

  const eligibleBase =
    isApiMode() && session && canAccessPulseTenantApis(session) && !isAdmin && !session.is_system_admin;

  useEffect(() => {
    const onReplay = () => {
      setOpen(true);
    };
    window.addEventListener(PULSE_OPEN_ONBOARDING_TOUR_EVENT, onReplay);
    return () => window.removeEventListener(PULSE_OPEN_ONBOARDING_TOUR_EVENT, onReplay);
  }, []);

  useEffect(() => {
    if (tourDone) setOpen(false);
  }, [tourDone]);

  useEffect(() => {
    if (eligibleBase && !tourDone) {
      setOpen(true);
    }
  }, [eligibleBase, tourDone]);

  const close = useCallback(async () => {
    await completeTour(refresh);
    setOpen(false);
  }, [refresh]);

  const skip = useCallback(async () => {
    await completeTour(refresh);
    setOpen(false);
  }, [refresh]);

  const guidedSteps: GuidedTourStep[] = useMemo(
    () => [
      {
        id: "alerts",
        title: "Active alerts",
        body: "Track critical issues in real time from the dashboard alerts card.",
        selector: '[data-guided-tour-anchor="dashboard-alerts"]',
      },
      {
        id: "workforce",
        title: "Workforce overview",
        body: "See who is on-site and on-shift from the workforce card.",
        selector: '[data-guided-tour-anchor="dashboard-workforce"]',
      },
      {
        id: "inventory",
        title: "Inventory and equipment",
        body: "Review inventory exceptions and equipment state from one place.",
        selector: '[data-guided-tour-anchor="dashboard-inventory"]',
      },
      {
        id: "done",
        title: "You're all set",
        body: "Use the dashboard to monitor operations, then continue with module checklists.",
      },
    ],
    [],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[560] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => void skip()}
      />
      <div className="ds-card-elevated relative w-full max-w-md p-6 shadow-[var(--ds-shadow-diffuse)]">
        <>
          <h2 className="font-headline text-xl font-bold text-ds-foreground">Welcome to Pulse</h2>
          <p className="mt-3 text-sm leading-relaxed text-ds-muted">
            Start a quick guided tour to learn the key dashboard areas.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button type="button" className="ds-btn-secondary order-2 px-4 py-2.5 text-sm" onClick={() => void skip()}>
              Skip
            </button>
            <button
              type="button"
              className="ds-btn-secondary order-1 px-4 py-2.5 text-sm"
              onClick={() => {
                router.push("/overview");
                void skip();
              }}
            >
              Open dashboard
            </button>
            <button
              type="button"
              className="ds-btn-solid-primary order-1 px-4 py-2.5 text-sm sm:order-3"
              onClick={() =>
                void (async () => {
                  startTour(guidedSteps);
                  setOpen(false);
                  await completeTour(refresh);
                })()
              }
            >
              Start tour
            </button>
          </div>
        </>
      </div>
    </div>
  );
}
