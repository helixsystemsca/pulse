import type { Transition, Variants } from "framer-motion";

/** Premium ease — no bounce */
export const LOGIN_EASE = [0.22, 1, 0.36, 1] as const;
export const LOGIN_EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Shared duration for logo emerge, logo settle, form reveal, and coming-soon slide. */
export const LOGIN_STEP_MS = 800;

const stepSeconds = LOGIN_STEP_MS / 1000;

export const LOGIN_INTRO_MS = {
  step: LOGIN_STEP_MS,
  scrimFade: 1000,
} as const;

export type LoginIntroStage =
  | "intro"
  | "logo-settle"
  | "reveal-form"
  | "reveal-card"
  | "complete";

export const loginScrimVariants: Variants = {
  intro: { opacity: 0.5 },
  idle: { opacity: 0 },
};

export const loginScrimTransition: Transition = {
  duration: LOGIN_INTRO_MS.scrimFade / 1000,
  ease: LOGIN_EASE,
};

/** Emerge from depth: small, faint → large, sharp (transform/opacity only). */
export const loginLogoEmergenceTransition: Transition = {
  opacity: { duration: stepSeconds, ease: LOGIN_EASE_OUT },
  scale: { duration: stepSeconds, ease: LOGIN_EASE_OUT },
};

export const loginLogoSettleTransition: Transition = {
  layout: { duration: stepSeconds, ease: LOGIN_EASE },
  scale: { duration: stepSeconds, ease: LOGIN_EASE },
  opacity: { duration: stepSeconds, ease: LOGIN_EASE },
};

export const loginFormRevealVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const loginFormRevealTransition: Transition = {
  duration: stepSeconds,
  ease: LOGIN_EASE,
};

export const loginTaglineVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const loginTaglineTransition: Transition = {
  duration: stepSeconds,
  ease: LOGIN_EASE,
};

export const loginComingSoonSlideVariants: Variants = {
  hidden: { opacity: 0, x: -72 },
  visible: { opacity: 1, x: 0 },
};

export const loginComingSoonSlideTransition: Transition = {
  duration: stepSeconds,
  ease: LOGIN_EASE,
};
