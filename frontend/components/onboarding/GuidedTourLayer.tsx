"use client";

import { useEffect, useMemo, useState } from "react";
import { useGuidedTour } from "./CoreGuidedTour";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

export function GuidedTourLayer() {
  const { tour, closeTour, nextStep, prevStep } = useGuidedTour();
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const step = tour.steps[tour.index] ?? null;

  useEffect(() => {
    if (!tour.open || !step?.selector) {
      setAnchorRect(null);
      return;
    }
    const selector = step.selector;
    const updateRect = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      setAnchorRect(el?.getBoundingClientRect() ?? null);
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [tour.open, step?.selector, step?.id]);

  const isAnchored = Boolean(anchorRect && step?.selector);
  const isLast = tour.index >= Math.max(0, tour.steps.length - 1);
  const marker = useMemo(() => `${tour.index + 1} / ${tour.steps.length}`, [tour.index, tour.steps.length]);

  if (!tour.open || !step) return null;

  const panelStyle = isAnchored
    ? {
        top: Math.min(window.innerHeight - 220, Math.max(16, (anchorRect?.bottom ?? 0) + 12)),
        left: Math.min(window.innerWidth - 420, Math.max(16, anchorRect?.left ?? 16)),
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-[560]">
      <button
        type="button"
        className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
        aria-label="Close guided tour"
        onClick={closeTour}
      />
      <div
        className={`relative rounded-xl border border-slate-200/90 bg-white p-5 shadow-xl dark:border-ds-border dark:bg-ds-primary ${
          isAnchored ? "absolute w-[min(26rem,92vw)]" : "mx-auto mt-[12vh] w-[min(32rem,92vw)]"
        }`}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ds-muted">{isAnchored ? "Guided step" : "Getting started"}</p>
        <h3 className="mt-1 text-xl font-bold text-ds-foreground">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ds-muted">{step.body}</p>
        <p className="mt-3 text-xs font-semibold text-ds-muted">{marker}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm")} onClick={prevStep} disabled={tour.index <= 0}>
            Back
          </button>
          <button type="button" className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-3 py-2 text-sm")} onClick={isLast ? closeTour : nextStep}>
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

