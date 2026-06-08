export type PrioritizationQuadrant = "quick_win" | "major_project" | "fill_in" | "low_priority" | "unscored";

export type PrioritizationScores = {
  impact: number;
  effort: number;
  risk: number;
  quadrant?: PrioritizationQuadrant;
};

export const QUADRANT_LABELS: Record<PrioritizationQuadrant, string> = {
  quick_win: "Quick wins",
  major_project: "Major projects",
  fill_in: "Fill-ins",
  low_priority: "Low priority",
  unscored: "Not scored",
};

export const QUADRANT_DESCRIPTIONS: Record<Exclude<PrioritizationQuadrant, "unscored">, string> = {
  quick_win: "High impact, low effort — do these first.",
  major_project: "High impact, higher effort — plan and resource carefully.",
  fill_in: "Lower impact but easy — slot in when capacity allows.",
  low_priority: "Defer or combine with other work.",
};

export function computePrioritizationQuadrant(impact: number, effort: number): Exclude<PrioritizationQuadrant, "unscored"> {
  const i = Math.max(1, Math.min(5, impact));
  const e = Math.max(1, Math.min(5, effort));
  if (i >= 4 && e <= 2) return "quick_win";
  if (i >= 4 && e >= 3) return "major_project";
  if (i <= 3 && e <= 2) return "fill_in";
  return "low_priority";
}

export function enrichPrioritization(scores: PrioritizationScores): PrioritizationScores {
  return {
    ...scores,
    quadrant: computePrioritizationQuadrant(scores.impact, scores.effort),
  };
}
