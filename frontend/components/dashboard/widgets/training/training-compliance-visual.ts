/** Semantic palette for training compliance UI — vibrant, dashboard-grade. */
export const TC_COLORS = {
  completed: { from: "#14B8A6", to: "#22C7A9", glow: "rgba(20,184,166,0.35)" },
  expiring: { from: "#F59E0B", to: "#F5A623", glow: "rgba(245,158,11,0.35)" },
  missing: { from: "#FF4D6D", to: "#FF5A7A", glow: "rgba(255,90,122,0.45)" },
} as const;

/** Second radial: strict “fully complete” routines-tier slots (blue / indigo + slate remainder). */
export const TC_COLORS_STRICT = {
  complete: { from: "#2563EB", to: "#6366F1", glow: "rgba(99,102,241,0.38)" },
  remainder: { from: "#94A3B8", to: "#64748B", glow: "rgba(100,116,139,0.28)" },
} as const;
