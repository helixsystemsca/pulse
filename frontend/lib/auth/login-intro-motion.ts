import type { Transition, Variants } from "framer-motion";

/** Premium ease — no bounce */
export const LOGIN_EASE = [0.22, 1, 0.36, 1] as const;
export const LOGIN_EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const LOGIN_INTRO_MS = {
  /** Small → large emerge from depth (opacity only, no blur) */
  heroEmergence: 1100,
  /** Large logo shrinks and slides into layout slot */
  logoSettle: 900,
  /** Brief beat before form */
  formPause: 450,
  /** Login modal fade */
  formReveal: 720,
  /** After form, coming soon slides in */
  comingSoonDelay: 380,
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
  opacity: { duration: LOGIN_INTRO_MS.heroEmergence / 1000, ease: LOGIN_EASE_OUT },
  scale: { duration: LOGIN_INTRO_MS.heroEmergence / 1000, ease: LOGIN_EASE_OUT },
};

export const loginLogoSettleTransition: Transition = {
  layout: { duration: LOGIN_INTRO_MS.logoSettle / 1000, ease: LOGIN_EASE },
  scale: { duration: LOGIN_INTRO_MS.logoSettle / 1000, ease: LOGIN_EASE },
  opacity: { duration: 0.25, ease: LOGIN_EASE },
};

export const loginFormRevealVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const loginFormRevealTransition: Transition = {
  duration: LOGIN_INTRO_MS.formReveal / 1000,
  ease: LOGIN_EASE,
};

export const loginTaglineVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const loginComingSoonSlideVariants: Variants = {
  hidden: { opacity: 0, x: -72 },
  visible: { opacity: 1, x: 0 },
};

export const loginComingSoonSlideTransition: Transition = {
  duration: 0.68,
  ease: LOGIN_EASE,
};
