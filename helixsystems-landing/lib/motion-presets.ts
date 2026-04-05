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
