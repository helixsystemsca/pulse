/** Shared Framer Motion presets — fast, minimal, premium SaaS feel */
export const bpEase = "easeInOut" as const;

export const bpDuration = {
  fast: 0.18,
  med: 0.22,
  slow: 0.28,
} as const;

export const bpTransition = {
  fast: { duration: bpDuration.fast, ease: bpEase },
  med: { duration: bpDuration.med, ease: bpEase },
  slow: { duration: bpDuration.slow, ease: bpEase },
} as const;

export const bpPage = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: bpTransition.med,
} as const;

export const bpHoverBtn = {
  whileHover: { scale: 1.02, boxShadow: "0 8px 22px rgba(0, 0, 0, 0.18)" },
  whileTap: { scale: 0.985 },
  transition: bpTransition.fast,
} as const;

export const bpHoverCard = {
  whileHover: { y: -4, boxShadow: "0 14px 36px rgba(0, 0, 0, 0.16)" },
  transition: bpTransition.med,
} as const;
