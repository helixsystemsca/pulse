/**
 * Global motion tokens for Pulse operations UI — subtle, fast, productivity-first.
 * Pair with `useReducedEffects()` for user/OS reduced-motion preferences.
 */
import type { Transition, Variants } from "framer-motion";

/** Durations in seconds — keep between ~160–280ms for UI chrome. */
export const motionDuration = {
  fast: 0.16,
  medium: 0.22,
  slow: 0.28,
  /** Long ambient loops (background only). */
  ambient: 28,
} as const;

/** Soft ease-out curves (minimal easing drama). */
export const motionEase = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
};

export const motionTransition = {
  fast: { duration: motionDuration.fast, ease: motionEase.out } satisfies Transition,
  medium: { duration: motionDuration.medium, ease: motionEase.out } satisfies Transition,
  slow: { duration: motionDuration.slow, ease: motionEase.out } satisfies Transition,
  /** Hover / micro-interactions */
  hover: { duration: motionDuration.fast, ease: motionEase.out } satisfies Transition,
  /** Modals / drawers — slightly slower for perceived quality */
  modal: { duration: motionDuration.slow, ease: motionEase.out } satisfies Transition,
} as const;

/** Tight spring — low bounce, quick settle */
export const motionSpring = {
  modal: { type: "spring" as const, stiffness: 520, damping: 38, mass: 0.85 },
  drawer: { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.9 },
};

/** Back-compat names used across older files */
export const bpEase = "easeInOut" as const;
export const bpDuration = {
  fast: motionDuration.fast,
  med: motionDuration.medium,
  slow: motionDuration.slow,
} as const;
export const bpTransition = {
  fast: motionTransition.fast,
  med: motionTransition.medium,
  slow: motionTransition.slow,
} as const;

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: motionTransition.medium },
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: motionTransition.fast },
};

export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: motionTransition.modal },
};

export const modalPanelVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.98,
    transition: { duration: 0.16, ease: motionEase.out },
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: motionSpring.modal,
  },
};

export const drawerPanelVariants: Variants = {
  hidden: { x: "100%", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } },
  show: { x: 0, transition: motionSpring.drawer },
};
