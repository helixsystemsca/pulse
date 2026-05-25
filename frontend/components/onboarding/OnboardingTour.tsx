"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw } from "lucide-react";
import { DASHBOARD_TOUR_STEPS } from "@/lib/onboarding/tour-steps";
import type { TourPlacement, TourStep } from "@/lib/onboarding/tour-steps";
import { clearTourCompleted, isTourCompleted, markTourCompleted } from "@/lib/onboarding/tour-storage";
import "./onboarding-tour.css";

const CARD_WIDTH = 420;
const CARD_HEIGHT = 300;
const CARD_OFFSET = 20;

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

function findTourElement(selector: string): Element | null {
  return document.querySelector(selector);
}

export function OnboardingTour({ steps = DASHBOARD_TOUR_STEPS }: { steps?: TourStep[] }) {
  const [mounted, setMounted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightStyle, setSpotlightStyle] = useState<SpotlightStyle | null>(null);
  const [cardStyle, setCardStyle] = useState<CardStyle | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!isTourCompleted()) {
      setShowStart(true);
    }
  }, []);

  const updatePositions = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;

    const element = findTourElement(step.target);
    if (!element) {
      console.warn(`Tour target not found: ${step.target}`);
      setSpotlightStyle(null);
      setCardStyle(null);
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    const apply = () => {
      const rect = element.getBoundingClientRect();
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
    setShowEnd(false);
    window.setTimeout(() => {
      setCurrentStep(0);
      setIsActive(true);
    }, 300);
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    markTourCompleted();
    window.setTimeout(() => setShowEnd(true), 300);
  }, []);

  const finishTour = useCallback(() => {
    setShowEnd(false);
  }, []);

  const restartTour = useCallback(() => {
    setIsActive(false);
    setShowEnd(false);
    setCurrentStep(0);
    clearTourCompleted();
    window.setTimeout(() => setShowStart(true), 300);
  }, []);

  const advanceFromMissing = useCallback(
    (fromIndex: number) => {
      for (let i = fromIndex + 1; i < steps.length; i += 1) {
        if (findTourElement(steps[i]!.target)) {
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
    if (!findTourElement(steps[next]!.target)) {
      advanceFromMissing(currentStep);
      return;
    }
    setCurrentStep(next);
  }, [advanceFromMissing, currentStep, endTour, steps]);

  const previousStep = useCallback(() => {
    if (currentStep <= 0) return;
    let prev = currentStep - 1;
    while (prev > 0 && !findTourElement(steps[prev]!.target)) {
      prev -= 1;
    }
    if (!findTourElement(steps[prev]!.target)) return;
    setCurrentStep(prev);
  }, [currentStep, steps]);

  useEffect(() => {
    if (!isActive) return;
    const step = steps[currentStep];
    if (step && !findTourElement(step.target)) {
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

  if (!mounted) return null;

  const step = steps[currentStep];

  const ui = (
    <>
      <button type="button" className="restart-btn" onClick={restartTour} aria-label="Restart product tour">
        <RotateCcw className="restart-icon h-4 w-4" aria-hidden />
        Restart Tour
      </button>

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

      {showEnd ? (
        <div className="tour-end-screen active" role="dialog" aria-modal="true" aria-labelledby="tour-end-title">
          <div className="end-icon" aria-hidden>
            ✓
          </div>
          <h1 id="tour-end-title" className="start-title">
            You&apos;re All Set!
          </h1>
          <p className="start-subtitle">
            You now know the key features of Panorama REC. Explore the platform and reach out if you have any
            questions.
          </p>
          <button type="button" className="btn-finish" onClick={finishTour}>
            Get Started
          </button>
        </div>
      ) : null}
    </>
  );

  return createPortal(ui, document.body);
}
