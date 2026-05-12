/**
 * Procedure-level tags for reporting / grouping (separate from matrix tier: Routines / High risk / General).
 * "Onboarding" is a scope flag on compliance settings: leadership marks which procedures count toward fully trained.
 */

export const PROCEDURE_TRACKING_TAG_IDS = ["general", "high", "emergency", "routine", "safety"] as const;

export type ProcedureTrackingTagId = (typeof PROCEDURE_TRACKING_TAG_IDS)[number];

export const PROCEDURE_TRACKING_TAG_LABELS: Record<ProcedureTrackingTagId, string> = {
  general: "General",
  high: "High",
  emergency: "Emergency",
  routine: "Routine",
  safety: "Safety",
};

export function isProcedureTrackingTagId(v: string): v is ProcedureTrackingTagId {
  return (PROCEDURE_TRACKING_TAG_IDS as readonly string[]).includes(v);
}

export function normalizeProcedureTrackingTags(raw: unknown): ProcedureTrackingTagId[] {
  if (!Array.isArray(raw)) return [];
  const out: ProcedureTrackingTagId[] = [];
  for (const item of raw) {
    const s = String(item).trim().toLowerCase();
    if (isProcedureTrackingTagId(s) && !out.includes(s)) out.push(s);
  }
  return out;
}
