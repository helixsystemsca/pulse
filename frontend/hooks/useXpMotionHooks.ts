"use client";

import { useMemo } from "react";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { useXPAnimation, XP_MOTION } from "@/lib/motion/xpMotion";

/** Bar fill, shimmer, and milestone-friendly motion presets. */
export function useXPBarMotion() {
  const { reduced } = useReducedEffects();
  return useXPAnimation(reduced);
}

/** Timing for the level-up overlay sequence. */
export function useLevelUpSequence() {
  const { reduced } = useReducedEffects();
  return useMemo(
    () => ({
      reduced,
      backdropDuration: reduced ? 0.18 : 0.35,
      ringDuration: reduced ? 0.25 : 0.55,
      burstDuration: reduced ? 0 : 0.4,
      titleStagger: reduced ? 0.04 : 0.09,
      autoCloseMs: reduced ? 1100 : Math.round(XP_MOTION.levelUpTotal * 1000),
    }),
    [reduced],
  );
}

/** Achievement card entrance / icon emphasis. */
export function useAchievementReveal() {
  const { reduced } = useReducedEffects();
  return useMemo(
    () => ({
      reduced,
      card: reduced
        ? {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.2 },
          }
        : {
            initial: { opacity: 0, y: 14, filter: "blur(4px)" },
            animate: { opacity: 1, y: 0, filter: "blur(0px)" },
            transition: { type: "spring" as const, stiffness: 260, damping: 26 },
          },
      iconPulse: reduced
        ? undefined
        : {
            scale: [1, 1.04, 1],
            transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] as const },
          },
    }),
    [reduced],
  );
}
