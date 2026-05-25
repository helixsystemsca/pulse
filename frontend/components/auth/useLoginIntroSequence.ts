"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { LOGIN_STEP_MS, type LoginIntroStage } from "@/lib/auth/login-intro-motion";

export function useLoginIntroSequence() {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<LoginIntroStage>(reducedMotion ? "complete" : "intro");

  useEffect(() => {
    if (reducedMotion) {
      setStage("complete");
      return;
    }

    const step = LOGIN_STEP_MS;
    const t1 = window.setTimeout(() => setStage("logo-settle"), step);
    const t2 = window.setTimeout(() => setStage("reveal-form"), step * 2);
    const t3 = window.setTimeout(() => setStage("reveal-card"), step * 3);
    const t4 = window.setTimeout(() => setStage("complete"), step * 4);

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
