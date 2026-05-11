/** Centralized motion tokens for XP / progression UI. Keep durations short and non-blocking. */

import type { Transition } from "framer-motion";

export const XP_MOTION = {
  toastEnter: 0.32,
  toastHold: 0.55,
  toastExit: 0.38,
  barSpring: { type: "spring" as const, stiffness: 118, damping: 22, mass: 0.85 },
  barSpringReduced: { type: "spring" as const, stiffness: 260, damping: 32, mass: 0.9 },
  shimmerSweep: 1.1,
  milestonePulse: 0.45,
  levelUpTotal: 2.6,
  achievementCard: 0.55,
} as const;

export function xpBarTransition(reduced: boolean): Transition {
  return reduced ? { type: "tween", duration: 0.2, ease: "easeOut" } : XP_MOTION.barSpring;
}

export function xpToastDurationMs(reduced: boolean): number {
  return reduced ? 520 : 880;
}

export function useXPAnimation(reduced: boolean) {
  return {
    reduced,
    toastDurationMs: xpToastDurationMs(reduced),
    barTransition: xpBarTransition(reduced),
    enableParticles: !reduced,
    enableShimmer: !reduced,
    levelUpAutocloseMs: reduced ? 1200 : Math.round(XP_MOTION.levelUpTotal * 1000),
  };
}
