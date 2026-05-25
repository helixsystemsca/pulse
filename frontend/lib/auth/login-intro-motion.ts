import type { Transition, Variants } from "framer-motion";

/** Premium ease — no bounce */
export const LOGIN_EASE = [0.22, 1, 0.36, 1] as const;

export const LOGIN_INTRO_MS = {
  heroFocus: 950,
  logoSettle: 600,
  formReveal: 520,
  comingSoonDelay: 400,
  scrimFade: 900,
} as const;

export const LOGIN_INTRO_TOTAL_MS =
  LOGIN_INTRO_MS.heroFocus +
  LOGIN_INTRO_MS.logoSettle +
  LOGIN_INTRO_MS.formReveal +
  LOGIN_INTRO_MS.comingSoonDelay;

export type LoginIntroStage = "intro" | "logo-settle" | "reveal-form" | "reveal-card" | "complete";

export const loginScrimVariants: Variants = {
  intro: { opacity: 0.52 },
  idle: { opacity: 0 },
};

export const loginScrimTransition: Transition = {
  duration: LOGIN_INTRO_MS.scrimFade / 1000,
  ease: LOGIN_EASE,
};

export const loginHeroLogoVariants: Variants = {
  hidden: {
    opacity: 0.05,
    scale: 2.65,
    y: 24,
    filter: "blur(16px)",
  },
  focus: {
    opacity: 0.82,
    scale: 1.12,
    y: -10,
    filter: "blur(2px)",
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    filter: "blur(0px)",
  },
};

export const loginHeroLogoTransition: Transition = {
  duration: LOGIN_INTRO_MS.heroFocus / 1000,
  ease: LOGIN_EASE,
};

export const loginFormRevealVariants: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(10px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

export const loginFormRevealTransition: Transition = {
  duration: LOGIN_INTRO_MS.formReveal / 1000,
  ease: LOGIN_EASE,
};

/** Opacity only — parent transform breaks `position: fixed` on the docked card. */
export const loginComingSoonVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const loginComingSoonTransition: Transition = {
  duration: 0.58,
  ease: LOGIN_EASE,
};

export const loginTaglineVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const loginLayoutLogoVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1 },
};

export const loginLayoutLogoTransition: Transition = {
  layout: { duration: LOGIN_INTRO_MS.logoSettle / 1000, ease: LOGIN_EASE },
  opacity: { duration: 0.35, ease: LOGIN_EASE },
  scale: { duration: LOGIN_INTRO_MS.logoSettle / 1000, ease: LOGIN_EASE },
};
