/**
 * Operational staffing rules (client-side). Extend with API-backed intelligence later.
 */

import type { Shift, ShiftTypeKey, Worker } from "@/lib/schedule/types";

export function normalizeCertCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Worker carries RO or P4 on their profile (case-insensitive codes). */
export function workerHasRoOrP4(worker: Worker | undefined): boolean {
  if (!worker?.active) return false;
  const certs = (worker.certifications ?? []).map(normalizeCertCode);
  return certs.some((c) => c === "RO" || c === "P4");
}

const BANDS: ShiftTypeKey[] = ["day", "afternoon", "night"];

function isStaffableWorkShift(s: Shift): boolean {
  return s.eventType === "work" && s.shiftKind !== "project_task";
}

/**
 * For each calendar date in `datesInScope` and each day / afternoon / night band:
 * if there is at least one staffed work shift in that band, require at least one
 * assigned worker with RO or P4 on file.
 */
export function computeRoP4BandCoverageGaps(
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

      const covered = staffed.some((s) => workerHasRoOrP4(workersById.get(s.workerId!)));
      if (!covered) {
        gaps.push({ date, band });
      }
    }
  }

  return { gapCount: gaps.length, gaps };
}
