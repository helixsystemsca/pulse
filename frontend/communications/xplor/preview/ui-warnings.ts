import type { PublicationWarning } from "../schema/publication";

/** Warnings suppressed in QA preview only (optional fields, not export blockers). */
const UI_SUPPRESSED_WARNING_CODES = new Set(["missing_instructor"]);

export function warningsForPreviewDisplay(warnings: readonly PublicationWarning[]): PublicationWarning[] {
  return warnings.filter((w) => !UI_SUPPRESSED_WARNING_CODES.has(w.code));
}

export function warningPreviewLabel(w: PublicationWarning | string): string {
  return typeof w === "string" ? w : w.message;
}
