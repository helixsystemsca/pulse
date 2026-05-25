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
import { DASHBOARD_TOUR_STEPS } from "@/lib/onboarding/tour-steps";
import type { TourPlacement, TourStep } from "@/lib/onboarding/tour-steps";
import { clearTourCompleted, isTourCompleted, markTourCompleted } from "@/lib/onboarding/tour-storage";
import { getTourTargetElements, getTourTargetUnionRect, hasTourTarget } from "@/lib/onboarding/tour-target";
import "@/components/onboarding/onboarding-tour.css";

const CARD_WIDTH = 420;
const CARD_HEIGHT = 300;
const CARD_OFFSET = 20;

const TOUR_PATH_PREFIXES = ["/overview", "/worker"];

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
  showRestartInHeader: boolean;
};

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(null);

export function useOnboardingTour(): OnboardingTourContextValue | null {
  return useContext(OnboardingTourContext);
}

function calculateCardPosition(rect: DOMRect, placement: TourPlacement): CardStyle {
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
  top = Math.max(8, Math.min(top, window.innerHeight - CARD_HEIGHT - 8));

  return { top, left };
}

export function OnboardingTourProvider({ children, steps = DASHBOARD_TOUR_STEPS }: { children: ReactNode; steps?: TourStep[] }) {
  const pathname = usePathname();
  const tourEnabled = TOUR_PATH_PREFIXES.some((p) => pathname === p || pathname?.startsWith(`${p}/`));

  const [mounted, setMounted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightStyle, setSpotlightStyle] = useState<SpotlightStyle | null>(null);
  const [cardStyle, setCardStyle] = useState<CardStyle | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !tourEnabled) return;
    if (!isTourCompleted()) {
      setShowStart(true);
    }
  }, [mounted, tourEnabled]);

  useEffect(() => {
    if (!tourEnabled) {
      setIsActive(false);
      setShowStart(false);
    }
  }, [tourEnabled]);

  const updatePositions = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;

    const elements = getTourTargetElements(step.target);
    const union = getTourTargetUnionRect(elements);
    if (!union) {
      console.warn(`Tour target not found: ${step.target}`);
      setSpotlightStyle(null);
      setCardStyle(null);
      return;
    }

    elements[0]?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    const apply = () => {
      const rect = getTourTargetUnionRect(getTourTargetElements(step.target));
      if (!rect) return;
      const pad = 4;
      setSpotlightStyle({
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
      setCardStyle(calculateCardPosition(rect, step.placement));
    };

    window.requestAnimationFrame(() => {
      apply();
      window.setTimeout(apply, 400);
    });
  }, [currentStep, steps]);

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

  const startTour = useCallback(() => {
    setShowStart(false);
    window.setTimeout(() => {
      setCurrentStep(0);
      setIsActive(true);
    }, 300);
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    markTourCompleted();
  }, []);

  const restartTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    clearTourCompleted();
    window.setTimeout(() => setShowStart(true), 300);
  }, []);

  const advanceFromMissing = useCallback(
    (fromIndex: number) => {
      for (let i = fromIndex + 1; i < steps.length; i += 1) {
        if (hasTourTarget(steps[i]!.target)) {
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
      endTour();
      return;
    }
    const next = currentStep + 1;
    if (!hasTourTarget(steps[next]!.target)) {
      advanceFromMissing(currentStep);
      return;
    }
    setCurrentStep(next);
  }, [advanceFromMissing, currentStep, endTour, steps]);

  const previousStep = useCallback(() => {
    if (currentStep <= 0) return;
    let prev = currentStep - 1;
    while (prev > 0 && !hasTourTarget(steps[prev]!.target)) {
      prev -= 1;
    }
    if (!hasTourTarget(steps[prev]!.target)) return;
    setCurrentStep(prev);
  }, [currentStep, steps]);

  useEffect(() => {
    if (!isActive) return;
    const step = steps[currentStep];
    if (step && !hasTourTarget(step.target)) {
      advanceFromMissing(currentStep);
    }
  }, [isActive, currentStep, steps, advanceFromMissing]);

  useEffect(() => {
    if (!isActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
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
  }, [isActive, nextStep, previousStep, endTour]);

  const contextValue = useMemo(
    () => ({
      restartTour,
      showRestartInHeader: tourEnabled,
    }),
    [restartTour, tourEnabled],
  );

  const step = steps[currentStep];

  const portal =
    mounted && tourEnabled ? (
      <>
        {isActive ? <div className="tour-overlay active" aria-hidden /> : null}

        {isActive && spotlightStyle ? (
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

        {showStart ? (
          <div className="tour-start-screen active" role="dialog" aria-modal="true" aria-labelledby="tour-start-title">
            <div className="start-icon" aria-hidden>
              🏊
            </div>
            <h1 id="tour-start-title" className="start-title">
              Welcome to Panorama REC
            </h1>
            <p className="start-subtitle">
              Let&apos;s take a quick tour of your new management platform. We&apos;ll walk through the key features
              that help you streamline operations and reduce friction.
            </p>
            <button type="button" className="btn-start" onClick={startTour}>
              Start Tour
            </button>
          </div>
        ) : null}

        {isActive && step && cardStyle ? (
          <div
            className="tour-card active"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-step-title"
            style={{ top: cardStyle.top, left: cardStyle.left }}
          >
            <div className="tour-header">
              <div className="tour-step-counter">
                Step {currentStep + 1} of {steps.length}
              </div>
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
            <div className="progress-dots" aria-hidden>
              {steps.map((_, index) => (
                <div key={index} className={`progress-dot ${index === currentStep ? "active" : ""}`} />
              ))}
            </div>
          </div>
        ) : null}

      </>
    ) : null;

  return (
    <OnboardingTourContext.Provider value={contextValue}>
      {children}
      {portal && typeof document !== "undefined" ? createPortal(portal, document.body) : null}
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
      aria-label="Restart product tour"
      title="Restart tour"
    >
      <RotateCcw className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2} aria-hidden />
      <span className="hidden sm:inline">Restart tour</span>
    </button>
  );
}
