/**
 * Availability layer — evaluates calendar cells independently from assignments.
 */

import { approvedTimeOffKind, normalizeWeekdayKey, weekdayKeyFromIso } from "@/lib/schedule/recurring";
import type { AvailabilityCellEvaluation } from "@/lib/schedule/operational-scheduling-model";
import type { WorkerSchedulingConstraints } from "@/lib/schedule/types";
import { bandForWindow } from "@/lib/schedule/shift-definition-catalog";
import type { ScheduleSettings, Shift, ShiftTypeKey, TimeOffBlock, Worker } from "@/lib/schedule/types";

function normalizeAvailability(av?: Worker["availability"]): Record<string, { available: boolean; start?: string; end?: string }> {
  if (!av) return {};
  const out: Record<string, { available: boolean; start?: string; end?: string }> = {};
  for (const [k, v] of Object.entries(av)) {
    if (!v || typeof v !== "object") continue;
    const key = normalizeWeekdayKey(k);
    out[key] = {
      available: v.available !== false,
      start: typeof v.start === "string" ? v.start : undefined,
      end: typeof v.end === "string" ? v.end : undefined,
    };
  }
  return out;
}

function constraints(w: Worker): WorkerSchedulingConstraints {
  return w.schedulingConstraints && typeof w.schedulingConstraints === "object" ? w.schedulingConstraints : {};
}

function placementBand(start: string, end: string): ShiftTypeKey {
  return bandForWindow(start, end);
}

/** Evaluate availability for a worker on a calendar date (no assignment yet). */
export function evaluateAvailabilityCell(
  worker: Worker,
  date: string,
  settings: ScheduleSettings,
  timeOffBlocks: TimeOffBlock[],
  /** Optional proposed assignment window for restricted checks */
  proposed?: { start: string; end: string },
): AvailabilityCellEvaluation {
  if (!worker.active) {
    return {
      kind: "unavailable",
      overlay: "none",
      dropAllowed: false,
      managerOverrideEligible: false,
      message: "Inactive worker",
    };
  }

  const off = approvedTimeOffKind(worker.id, date, timeOffBlocks);
  if (off) {
    return {
      kind: "unavailable",
      overlay: "none",
      dropAllowed: false,
      managerOverrideEligible: false,
      message: off === "sick" ? "Sick leave this day" : "Vacation this day",
    };
  }

  const dow = weekdayKeyFromIso(date);
  const avMap = normalizeAvailability(worker.availability);
  const dayAv = avMap[dow];

  if (dayAv && dayAv.available === false) {
    return {
      kind: "unavailable",
      overlay: "none",
      dropAllowed: false,
      managerOverrideEligible: false,
      message: "Employee marked unavailable for this day.",
    };
  }

  const c = constraints(worker);
  let overlay: AvailabilityCellEvaluation["overlay"] = "none";

  if (dayAv?.start && dayAv?.end) {
    overlay = "stripe-diagonal";
  }
  if (c.afternoonsOnly) overlay = "edge-afternoon";
  if (c.morningsOnly) overlay = "edge-morning";

  if (!proposed) {
    return {
      kind: dayAv?.start && dayAv?.end ? "restricted" : "available",
      overlay,
      dropAllowed: true,
      message:
        dayAv?.start && dayAv?.end
          ? `Preferred window ${dayAv.start}–${dayAv.end}`
          : "Available",
    };
  }

  const band = placementBand(proposed.start, proposed.end);

  if (c.noNights && band === "night") {
    return {
      kind: "restricted",
      overlay,
      dropAllowed: false,
      needsOverrideForBand: "night",
      managerOverrideEligible: true,
      message: "Cannot work nights — manager override required.",
    };
  }

  if (c.afternoonsOnly && band !== "afternoon") {
    return {
      kind: "restricted",
      overlay,
      dropAllowed: false,
      needsOverrideForBand: band,
      managerOverrideEligible: true,
      message: "Afternoons only — manager override required.",
    };
  }

  if (c.morningsOnly && band !== "day") {
    return {
      kind: "restricted",
      overlay,
      dropAllowed: false,
      needsOverrideForBand: band,
      managerOverrideEligible: true,
      message: "Mornings only — manager override required.",
    };
  }

  if (dayAv?.start && dayAv?.end) {
    const ok = proposed.start >= dayAv.start && proposed.end <= dayAv.end;
    if (!ok) {
      return {
        kind: "restricted",
        overlay,
        dropAllowed: false,
        managerOverrideEligible: true,
        message: `Outside preferred hours (${dayAv.start}–${dayAv.end})`,
      };
    }
  }

  return {
    kind: "available",
    overlay,
    dropAllowed: true,
    message: "Available",
  };
}

/** Merge legacy evaluateWorkerDrop behaviour: cert + OT still enforced separately by caller. */
export function evaluateAvailabilityForDrop(
  worker: Worker,
  date: string,
  proposed: { start: string; end: string },
  _shifts: Shift[],
  settings: ScheduleSettings,
  timeOffBlocks: TimeOffBlock[],
): { ok: boolean; tooltip?: string; needsOverride?: boolean } {
  const ev = evaluateAvailabilityCell(worker, date, settings, timeOffBlocks, proposed);
  if (ev.kind === "unavailable") {
    return { ok: false, tooltip: ev.message, needsOverride: false };
  }
  if (!ev.dropAllowed) {
    return {
      ok: false,
      tooltip: ev.message,
      needsOverride: ev.managerOverrideEligible === true,
    };
  }
  return { ok: true };
}
