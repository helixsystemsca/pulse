/**
 * Operational staffing rules (client-side). Extend with API-backed intelligence later.
 *
 * **RO on-site rule:** For each calendar day and each day / afternoon / night band that has
 * staffed work shifts, at least one assigned worker must hold **RO** (Refrigeration Operator)
 * certification. **P4** (4th class Power Engineer) counts toward the same requirement — a P4
 * holder satisfies RO coverage for schedule preview / gap detection.
 */

import type { Shift, ShiftTypeKey, Worker } from "@/lib/schedule/types";

/** Cert codes that satisfy the “refrigeration operator on site” band check (RO required; P4 qualifies). */
export const RO_ONSITE_COVERAGE_CERT_CODES = ["RO", "P4"] as const;

export function normalizeCertCode(code: string): string {
  return code.trim().toUpperCase();
}

/** True when the worker is active and holds RO, or P4 which counts toward RO coverage. */
export function workerSatisfiesRoOnSiteRequirement(worker: Worker | undefined): boolean {
  if (!worker?.active) return false;
  const certs = (worker.certifications ?? []).map(normalizeCertCode);
  return certs.some((c) => c === "RO" || c === "P4");
}

/** @deprecated Use {@link workerSatisfiesRoOnSiteRequirement} — same behavior (RO or qualifying P4). */
export const workerHasRoOrP4 = workerSatisfiesRoOnSiteRequirement;

const BANDS: ShiftTypeKey[] = ["day", "afternoon", "night"];

function isStaffableWorkShift(s: Shift): boolean {
  return s.eventType === "work" && s.shiftKind !== "project_task";
}

/**
 * For each date in `datesInScope` and each day / afternoon / night band: if that band has at
 * least one staffed work shift, require at least one assigned worker who satisfies the RO on-site
 * rule ({@link workerSatisfiesRoOnSiteRequirement}). Empty bands are skipped.
 *
 * Use this for the visible schedule month (or any date range) to preview gaps before publishing.
 */
export function computeRoBandCoverageGaps(
  shifts: Shift[],
  workersById: Map<string, Worker>,
  datesInScope: string[],
): { gapCount: number; gaps: Array<{ date: string; band: ShiftTypeKey }> } {
  const gaps: Array<{ date: string; band: ShiftTypeKey }> = [];

  for (const date of datesInScope) {
    for (const band of BANDS) {
      const bandShifts = shifts.filter(
        (s) => s.date === date && s.shiftType === band && isStaffableWorkShift(s),
      );
      const staffed = bandShifts.filter((s) => s.workerId);
      if (staffed.length === 0) continue;

      const covered = staffed.some((s) => workerSatisfiesRoOnSiteRequirement(workersById.get(s.workerId!)));
      if (!covered) {
        gaps.push({ date, band });
      }
    }
  }

  return { gapCount: gaps.length, gaps };
}

/** @deprecated Use {@link computeRoBandCoverageGaps} — same result. */
export const computeRoP4BandCoverageGaps = computeRoBandCoverageGaps;
