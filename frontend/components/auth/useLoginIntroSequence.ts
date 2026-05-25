"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  LOGIN_INTRO_MS,
  type LoginIntroStage,
} from "@/lib/auth/login-intro-motion";

export function useLoginIntroSequence() {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<LoginIntroStage>(reducedMotion ? "complete" : "intro");

  useEffect(() => {
    if (reducedMotion) {
      setStage("complete");
      return;
    }

    const t1 = window.setTimeout(() => setStage("logo-settle"), LOGIN_INTRO_MS.heroFocus);
    const t2 = window.setTimeout(
      () => setStage("reveal-form"),
      LOGIN_INTRO_MS.heroFocus + LOGIN_INTRO_MS.logoSettle,
    );
    const t3 = window.setTimeout(
      () => setStage("reveal-card"),
      LOGIN_INTRO_MS.heroFocus + LOGIN_INTRO_MS.logoSettle + LOGIN_INTRO_MS.formReveal,
    );
    const t4 = window.setTimeout(
      () => setStage("complete"),
      LOGIN_INTRO_MS.heroFocus +
        LOGIN_INTRO_MS.logoSettle +
        LOGIN_INTRO_MS.formReveal +
        LOGIN_INTRO_MS.comingSoonDelay +
        200,
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
    showHeroLogo: stage === "intro",
    showLayoutLogo: stage !== "intro",
    showForm: stage === "reveal-form" || stage === "reveal-card" || stage === "complete",
    showComingSoon: stage === "reveal-card" || stage === "complete",
    showTagline: stage === "reveal-form" || stage === "reveal-card" || stage === "complete",
    scrimActive: stage === "intro",
  };
}
