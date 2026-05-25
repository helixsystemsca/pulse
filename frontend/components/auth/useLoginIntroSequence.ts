"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  LOGIN_INTRO_MS,
  type LoginIntroStage,
} from "@/lib/auth/login-intro-motion";

function introDelayMs(): number {
  return (
    LOGIN_INTRO_MS.heroEmergence +
    LOGIN_INTRO_MS.logoSettle +
    LOGIN_INTRO_MS.formPause
  );
}

export function useLoginIntroSequence() {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<LoginIntroStage>(reducedMotion ? "complete" : "intro");

  useEffect(() => {
    if (reducedMotion) {
      setStage("complete");
      return;
    }

    const t1 = window.setTimeout(() => setStage("logo-settle"), LOGIN_INTRO_MS.heroEmergence);
    const t2 = window.setTimeout(
      () => setStage("reveal-form"),
      LOGIN_INTRO_MS.heroEmergence + LOGIN_INTRO_MS.logoSettle + LOGIN_INTRO_MS.formPause,
    );
    const t3 = window.setTimeout(
      () => setStage("reveal-card"),
      introDelayMs() + LOGIN_INTRO_MS.formReveal + LOGIN_INTRO_MS.comingSoonDelay,
    );
    const t4 = window.setTimeout(
      () => setStage("complete"),
      introDelayMs() +
        LOGIN_INTRO_MS.formReveal +
        LOGIN_INTRO_MS.comingSoonDelay +
        720,
    );

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [reducedMotion]);

  return {
    stage,
    reducedMotion: Boolean(reducedMotion),
    showForm: stage === "reveal-form" || stage === "reveal-card" || stage === "complete",
    showComingSoon: stage === "reveal-card" || stage === "complete",
    showTagline: stage === "reveal-form" || stage === "reveal-card" || stage === "complete",
    scrimActive: stage === "intro",
  };
}
