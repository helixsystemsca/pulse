"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type GuidedTourStep = {
  id: string;
  title: string;
  body: string;
  selector?: string;
};

type TourState = {
  open: boolean;
  steps: GuidedTourStep[];
  index: number;
};

type Ctx = {
  tour: TourState;
  startTour: (steps: GuidedTourStep[], startIndex?: number) => void;
  closeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  setIndex: (i: number) => void;
};

const GuidedTourContext = createContext<Ctx | null>(null);

export function useGuidedTour() {
  const ctx = useContext(GuidedTourContext);
  if (!ctx) throw new Error("useGuidedTour must be used inside GuidedTourProvider");
  return ctx;
}

export function GuidedTourProvider({ children }: { children: ReactNode }) {
  const [tour, setTour] = useState<TourState>({ open: false, steps: [], index: 0 });

  const startTour = useCallback((steps: GuidedTourStep[], startIndex = 0) => {
    setTour({ open: true, steps, index: Math.max(0, Math.min(startIndex, steps.length - 1)) });
  }, []);
  const closeTour = useCallback(() => setTour((t) => ({ ...t, open: false })), []);
  const nextStep = useCallback(() => {
    setTour((t) => ({ ...t, index: Math.min(t.index + 1, Math.max(0, t.steps.length - 1)) }));
  }, []);
  const prevStep = useCallback(() => setTour((t) => ({ ...t, index: Math.max(0, t.index - 1) })), []);
  const setIndex = useCallback((i: number) => {
    setTour((t) => ({ ...t, index: Math.max(0, Math.min(i, Math.max(0, t.steps.length - 1))) }));
  }, []);

  const value = useMemo(
    () => ({ tour, startTour, closeTour, nextStep, prevStep, setIndex }),
    [tour, startTour, closeTour, nextStep, prevStep, setIndex],
  );

  return <GuidedTourContext.Provider value={value}>{children}</GuidedTourContext.Provider>;
}

export function useGuidedTourAnchor(anchorId: string) {
  return { "data-guided-tour-anchor": anchorId };
}

