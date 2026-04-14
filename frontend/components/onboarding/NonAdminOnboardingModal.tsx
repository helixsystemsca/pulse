"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isApiMode, refreshPulseUserFromServer } from "@/lib/api";
import { PULSE_OPEN_ONBOARDING_TOUR_EVENT } from "@/lib/onboarding-events";
import { patchOnboarding } from "@/lib/onboardingService";
import { canAccessPulseTenantApis } from "@/lib/pulse-session";
import { sessionHasAnyRole, sessionPrimaryRole } from "@/lib/pulse-roles";
import { usePulseAuth } from "@/hooks/usePulseAuth";

type Slide = { title: string; body: string; tryHref: string; tryLabel: string };

function slidesForRole(role: string): Slide[] {
  if (role === "worker") {
    return [
      {
        title: "View your tasks",
        body: "See assigned work orders and what needs attention next.",
        tryHref: "/dashboard/maintenance",
        tryLabel: "Try it",
      },
      {
        title: "Update status",
        body: "Move work forward from open to complete as you finish the job.",
        tryHref: "/dashboard/maintenance",
        tryLabel: "Try it",
      },
      {
        title: "Add photos & notes",
        body: "Capture proof and details on the work order so the team stays aligned.",
        tryHref: "/dashboard/maintenance",
        tryLabel: "Try it",
      },
    ];
  }
  return [
    {
      title: "Work orders",
      body: "Create and track maintenance work in one place.",
      tryHref: "/dashboard/maintenance",
      tryLabel: "Try it",
    },
    {
      title: "Scheduling",
      body: "Review shifts and coverage for your team.",
      tryHref: "/schedule",
      tryLabel: "Try it",
    },
    {
      title: "Alerts & monitoring",
      body: "Watch facility signals and respond before issues grow.",
      tryHref: "/monitoring",
      tryLabel: "Try it",
    },
  ];
}

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
  const [step, setStep] = useState(0);

  const isAdmin = Boolean(session && sessionHasAnyRole(session, "company_admin"));
  const tourDone = Boolean(session?.user_onboarding_tour_completed);

  const role = session ? sessionPrimaryRole(session) : "worker";
  const slides = useMemo(() => slidesForRole(role), [role]);

  const eligibleBase =
    isApiMode() && session && canAccessPulseTenantApis(session) && !isAdmin && !session.is_system_admin;

  useEffect(() => {
    const onReplay = () => {
      setStep(0);
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
      setStep(0);
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

  const totalSteps = 1 + slides.length;
  const onNext = () => {
    if (step < totalSteps - 1) setStep((s) => s + 1);
    else void close();
  };

  if (!open) return null;

  const intro = step === 0;
  const slide = !intro ? slides[step - 1] : null;

  return (
    <div className="fixed inset-0 z-[560] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => void skip()}
      />
      <div className="ds-card-elevated relative w-full max-w-md p-6 shadow-[var(--ds-shadow-diffuse)]">
        {intro ? (
          <>
            <h2 className="font-headline text-xl font-bold text-ds-foreground">Welcome to Pulse</h2>
            <p className="mt-3 text-sm leading-relaxed text-ds-muted">Here&apos;s what you can do</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button type="button" className="ds-btn-secondary order-2 px-4 py-2.5 text-sm" onClick={() => void skip()}>
                Skip
              </button>
              <button
                type="button"
                className="ds-btn-solid-primary order-1 px-4 py-2.5 text-sm sm:order-3"
                onClick={() => setStep(1)}
              >
                Start
              </button>
            </div>
          </>
        ) : slide ? (
          <>
            <h2 className="font-headline text-xl font-bold text-ds-foreground">{slide.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ds-muted">{slide.body}</p>
            <p className="mt-4 text-xs text-ds-muted">
              {step} / {totalSteps - 1}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button type="button" className="ds-btn-secondary px-4 py-2.5 text-sm" onClick={() => void skip()}>
                Skip
              </button>
              <button
                type="button"
                className="ds-btn-secondary px-4 py-2.5 text-sm"
                onClick={() => {
                  router.push(slide.tryHref);
                  void skip();
                }}
              >
                {slide.tryLabel}
              </button>
              <button type="button" className="ds-btn-solid-primary px-4 py-2.5 text-sm" onClick={onNext}>
                {step >= totalSteps - 1 ? "Done" : "Next"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
