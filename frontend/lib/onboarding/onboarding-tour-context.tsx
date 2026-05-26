"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { RotateCcw } from "lucide-react";
import type { TourPlacement, TourStep } from "@/lib/onboarding/tour-steps/types";
import {
  clearTourCompleted,
  isTourCompleted,
  markTourCompleted,
  resetAllOnboardingTours,
} from "@/lib/onboarding/tour-storage";
import {
  getTourTargetElements,
  getTourTargetUnionRect,
  hasTourTarget,
  stepHasTourTarget,
} from "@/lib/onboarding/tour-target";
import { buildNavigationTree } from "@/lib/navigation/build-navigation-tree";
import { useOnboardingFlyoutBridge } from "@/lib/onboarding/onboarding-flyout-bridge";
import { hasProductTour, resolveProductTour } from "@/lib/onboarding/tour-registry";
import { formatTourWelcomeLine } from "@/lib/onboarding/tour-welcome";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { cn } from "@/lib/cn";
import "@/components/onboarding/onboarding-tour.css";

const CARD_WIDTH = 420;
const CARD_HEIGHT = 300;
const CARD_OFFSET = 20;
/** Keep step cards off the viewport bottom (feature tours often anchor near the page footer). */
const CARD_VIEWPORT_INSET_BOTTOM = 48;

type SpotlightStyle = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type CardStyle = {
  top: number;
  left: number;
};

type OnboardingTourContextValue = {
  restartTour: () => void;
  /** Clears every completed tour in this browser; starts current page tour if one exists. */
  resetAllTours: () => void;
  showRestartInHeader: boolean;
  tourId: string | null;
};

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(null);

export function useOnboardingTour(): OnboardingTourContextValue | null {
  return useContext(OnboardingTourContext);
}

function calculateCenterCardPosition(): CardStyle {
  return {
    top: Math.max(8, (window.innerHeight - CARD_HEIGHT) / 2),
    left: Math.max(8, (window.innerWidth - CARD_WIDTH) / 2),
  };
}

function calculateCardPosition(rect: DOMRect, placement: TourPlacement): CardStyle {
  if (placement === "center") {
    return calculateCenterCardPosition();
  }
  let top = rect.top;
  let left = rect.left;

  switch (placement) {
    case "right":
      top = rect.top;
      left = rect.right + CARD_OFFSET;
      if (left + CARD_WIDTH > window.innerWidth) {
        left = rect.left - CARD_WIDTH - CARD_OFFSET;
      }
      break;
    case "left":
      top = rect.top;
      left = rect.left - CARD_WIDTH - CARD_OFFSET;
      if (left < 8) {
        left = rect.right + CARD_OFFSET;
      }
      break;
    case "bottom":
      top = rect.bottom + CARD_OFFSET;
      left = rect.left;
      if (top + CARD_HEIGHT > window.innerHeight) {
        top = rect.top - CARD_HEIGHT - CARD_OFFSET;
      }
      break;
    case "top":
      top = rect.top - CARD_HEIGHT - CARD_OFFSET;
      left = rect.left;
      if (top < 8) {
        top = rect.bottom + CARD_OFFSET;
      }
      break;
    default:
      left = rect.right + CARD_OFFSET;
  }

  left = Math.max(8, Math.min(left, window.innerWidth - CARD_WIDTH - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - CARD_HEIGHT - CARD_VIEWPORT_INSET_BOTTOM));

  return { top, left };
}

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { session } = usePulseAuth();
  const flyoutBridge = useOnboardingFlyoutBridge();
  const navigationTree = useMemo(() => buildNavigationTree(session), [session]);
  const activeTour = useMemo(
    () => resolveProductTour(pathname, navigationTree),
    [pathname, navigationTree],
  );
  const tourEnabled = hasProductTour(pathname, navigationTree);
  const tourId = activeTour?.id ?? null;
  const showsCompletionScreen = Boolean(activeTour?.showCompletionScreen);
  const steps = useMemo(
    () => (activeTour?.steps ?? []).filter((s) => s.target !== '[data-tour="feature-header"]'),
    [activeTour?.steps],
  );

  const [mounted, setMounted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [completeFading, setCompleteFading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightStyle, setSpotlightStyle] = useState<SpotlightStyle | null>(null);
  const [cardStyle, setCardStyle] = useState<CardStyle | null>(null);
  const [rotateIndex, setRotateIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsActive(false);
    setShowComplete(false);
    setCompleteFading(false);
    setCurrentStep(0);
    setRotateIndex(0);
  }, [tourId]);

  useEffect(() => {
    setRotateIndex(0);
  }, [currentStep]);

  useEffect(() => {
    if (!mounted || !tourEnabled || !tourId) return;
    if (!isTourCompleted(tourId)) {
      setCurrentStep(0);
      setIsActive(true);
    }
  }, [mounted, tourEnabled, tourId]);

  useEffect(() => {
    flyoutBridge?.setTourActive(isActive);
    flyoutBridge?.setTourFlyoutDomain(null);
  }, [isActive, flyoutBridge]);

  const updatePositions = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;

    const rotatePool =
      step.rotateTargets?.filter((selector) => hasTourTarget(selector)) ?? [];
    const rotating = rotatePool.length > 0;
    const spotlightSelector = rotating
      ? rotatePool[rotateIndex % rotatePool.length]!
      : step.target;

    const elements = getTourTargetElements(spotlightSelector);
    const union = getTourTargetUnionRect(elements);
    if (!union) {
      if (rotating) {
        setSpotlightStyle(null);
        if (step.placement === "center") {
          setCardStyle(calculateCenterCardPosition());
        }
        return;
      }
      console.warn(`Tour target not found: ${spotlightSelector}`);
      setSpotlightStyle(null);
      setCardStyle(null);
      return;
    }

    if (!rotating && step.placement !== "center") {
      elements[0]?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    const apply = () => {
      const rect = getTourTargetUnionRect(getTourTargetElements(spotlightSelector));
      if (!rect) return;
      const pad = 4;
      setSpotlightStyle({
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
      if (step.placement === "center") {
        setCardStyle(calculateCenterCardPosition());
        return;
      }
      const cardRect = step.cardTarget
        ? getTourTargetUnionRect(getTourTargetElements(step.cardTarget)) ?? rect
        : rect;
      setCardStyle(calculateCardPosition(cardRect, step.placement));
    };

    window.requestAnimationFrame(() => {
      apply();
      window.setTimeout(apply, rotating ? 80 : 400);
    });
  }, [currentStep, rotateIndex, steps]);

  useEffect(() => {
    if (!isActive) return;
    const step = steps[currentStep];
    const pool = step.rotateTargets?.filter((selector) => hasTourTarget(selector)) ?? [];
    if (pool.length < 2) return;
    const ms = step.rotateIntervalMs ?? 2400;
    const id = window.setInterval(() => {
      setRotateIndex((i) => (i + 1) % pool.length);
    }, ms);
    return () => window.clearInterval(id);
  }, [isActive, currentStep, steps]);

  useLayoutEffect(() => {
    if (!isActive) return;
    updatePositions();
    window.addEventListener("resize", updatePositions);
    window.addEventListener("scroll", updatePositions, true);
    return () => {
      window.removeEventListener("resize", updatePositions);
      window.removeEventListener("scroll", updatePositions, true);
    };
  }, [isActive, updatePositions]);

  const endTour = useCallback(() => {
    setIsActive(false);
    setShowComplete(false);
    setCompleteFading(false);
    if (tourId) markTourCompleted(tourId);
  }, [tourId]);

  const finishTour = useCallback(() => {
    setShowComplete(true);
  }, []);

  useEffect(() => {
    if (!showComplete) return;
    const fadeTimer = window.setTimeout(() => setCompleteFading(true), 2000);
    const endTimer = window.setTimeout(() => endTour(), 2600);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(endTimer);
    };
  }, [showComplete, endTour]);

  const restartTour = useCallback(() => {
    if (!tourId) return;
    setShowComplete(false);
    setCompleteFading(false);
    clearTourCompleted(tourId);
    setCurrentStep(0);
    setIsActive(true);
  }, [tourId]);

  const resetAllTours = useCallback(() => {
    resetAllOnboardingTours();
    setShowComplete(false);
    setCompleteFading(false);
    setCurrentStep(0);
    if (tourEnabled && tourId) {
      setIsActive(true);
    } else {
      setIsActive(false);
    }
  }, [tourEnabled, tourId]);

  const advanceFromMissing = useCallback(
    (fromIndex: number) => {
      for (let i = fromIndex + 1; i < steps.length; i += 1) {
        if (stepHasTourTarget(steps[i]!)) {
          setCurrentStep(i);
          return;
        }
      }
      endTour();
    },
    [steps, endTour],
  );

  const nextStep = useCallback(() => {
    if (currentStep >= steps.length - 1) {
      if (showsCompletionScreen) finishTour();
      else endTour();
      return;
    }
    const next = currentStep + 1;
    if (!stepHasTourTarget(steps[next]!)) {
      advanceFromMissing(currentStep);
      return;
    }
    setCurrentStep(next);
  }, [advanceFromMissing, currentStep, endTour, finishTour, showsCompletionScreen, steps]);

  const previousStep = useCallback(() => {
    if (currentStep <= 0) return;
    let prev = currentStep - 1;
    while (prev > 0 && !stepHasTourTarget(steps[prev]!)) {
      prev -= 1;
    }
    if (!stepHasTourTarget(steps[prev]!)) return;
    setCurrentStep(prev);
  }, [currentStep, steps]);

  useEffect(() => {
    if (!isActive || showComplete) return;
    const step = steps[currentStep];
    if (!step || stepHasTourTarget(step)) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 25;

    const tick = () => {
      if (cancelled) return;
      attempts += 1;
      updatePositions();
      if (stepHasTourTarget(step)) return;
      if (attempts >= maxAttempts) advanceFromMissing(currentStep);
    };

    tick();
    const interval = window.setInterval(tick, 200);
    const observer = new MutationObserver(tick);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, [isActive, showComplete, currentStep, steps, advanceFromMissing, updatePositions]);

  useEffect(() => {
    if (!isActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (showComplete) {
        if (e.key === "Escape") {
          e.preventDefault();
          endTour();
        }
        return;
      }
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        previousStep();
      } else if (e.key === "Escape") {
        e.preventDefault();
        endTour();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isActive, showComplete, nextStep, previousStep, endTour]);

  const contextValue = useMemo(
    () => ({
      restartTour,
      resetAllTours,
      showRestartInHeader: tourEnabled,
      tourId,
    }),
    [restartTour, resetAllTours, tourEnabled, tourId],
  );

  const step = steps[currentStep];
  const welcomeLine = formatTourWelcomeLine(activeTour?.welcomeTitle ?? "this page");

  const portal =
    mounted && tourEnabled && activeTour ? (
      <>
        {isActive || showComplete ? <div className="tour-overlay active" aria-hidden /> : null}

        {isActive && !showComplete && spotlightStyle ? (
          <div
            className="spotlight"
            style={{
              top: spotlightStyle.top,
              left: spotlightStyle.left,
              width: spotlightStyle.width,
              height: spotlightStyle.height,
            }}
          />
        ) : null}

        {showComplete && showsCompletionScreen ? (
          <div
            className={cn("tour-end-screen active", completeFading && "tour-end-screen--fading")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-complete-title"
          >
            <div className="tour-complete-check" aria-hidden>
              <svg className="tour-complete-check__svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="tour-complete-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
                <circle className="tour-complete-check__pulse" cx="50" cy="50" r="48" fill="none" stroke="#34d399" strokeWidth="2" />
                <circle className="tour-complete-check__circle" cx="50" cy="50" r="44" fill="url(#tour-complete-gradient)" />
                <path
                  className="tour-complete-check__mark"
                  d="M30 52 L44 66 L72 38"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 id="tour-complete-title" className="end-title">
              You&apos;re all set!
            </h2>
          </div>
        ) : null}

        {isActive && !showComplete && step && cardStyle ? (
          <div
            className={cn("tour-card active", step.placement === "center" && "tour-card--center")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-step-title"
            style={{ top: cardStyle.top, left: cardStyle.left }}
          >
            <div className="tour-header">
              {currentStep === 0 ? (
                <p className="tour-welcome-line">{welcomeLine}</p>
              ) : null}
              <h2 id="tour-step-title" className="tour-title">
                {step.title}
              </h2>
            </div>
            <p className="tour-description">{step.description}</p>
            <div className="tour-actions">
              {currentStep > 0 ? (
                <button type="button" className="tour-btn tour-btn-secondary" onClick={previousStep}>
                  Back
                </button>
              ) : null}
              <button type="button" className="tour-btn tour-btn-primary" onClick={nextStep}>
                {currentStep === steps.length - 1 ? "Finish" : "Next"}
              </button>
            </div>
            {steps.length > 1 ? (
              <div className="progress-dots" aria-hidden>
                {steps.map((_, index) => (
                  <div key={index} className={`progress-dot ${index === currentStep ? "active" : ""}`} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </>
    ) : null;

  return (
    <OnboardingTourContext.Provider value={contextValue}>
      {children}
      {mounted && portal ? createPortal(portal, document.body) : null}
    </OnboardingTourContext.Provider>
  );
}

export function OnboardingTourRestartButton() {
  const ctx = useOnboardingTour();
  if (!ctx?.showRestartInHeader) return null;

  return (
    <button
      type="button"
      className="restart-tour-header-btn"
      onClick={ctx.restartTour}
      aria-label="Restart product tour for this page"
      title="Restart tour for this page"
    >
      <RotateCcw className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2} aria-hidden />
      <span className="hidden sm:inline">Restart tour</span>
    </button>
  );
}
