/**
 * Operational scheduling model — three explicit layers:
 *
 * 1. **Availability** — whether / how a worker can be placed (constraints). Drives cell chrome + drag/drop.
 * 2. **Assignment** — scheduled shift blocks identified primarily by compact shift codes (D1, A1, …).
 * 3. **Operational metadata** — badges (TRN, PTO, GG, …) with semantic grouping for styling/tooltips.
 *
 * Availability is intentionally separate from assignment so we can later plug in compliance,
 * qualifications, and auto-scheduling without entangling “paint color” with “shift identity”.
 */

import type { ShiftTypeKey } from "@/lib/schedule/types";

/** Canonical windows for standardized shift codes (24h HH:mm). Overnight: end < start. */
export type StandardShiftDefinition = {
  code: string;
  label: string;
  band: ShiftTypeKey;
  start: string;
  end: string;
  /** Tooltip / detail copy */
  description?: string;
};

/** Built-in catalog — extend via org settings / API later. */
export const STANDARD_SHIFT_CATALOG: StandardShiftDefinition[] = [
  { code: "D1", label: "Day Shift", band: "day", start: "06:00", end: "14:00", description: "Early day coverage" },
  { code: "D2", label: "Day Shift", band: "day", start: "08:00", end: "16:00", description: "Standard day" },
  { code: "A1", label: "Afternoon", band: "afternoon", start: "14:00", end: "22:00", description: "Afternoon swing" },
  { code: "A2", label: "Afternoon", band: "afternoon", start: "15:00", end: "23:00", description: "Late swing" },
  { code: "N1", label: "Night", band: "night", start: "22:00", end: "06:00", description: "Overnight" },
  { code: "N2", label: "Night", band: "night", start: "23:00", end: "07:00", description: "Late overnight" },
  { code: "GG", label: "Greenglade", band: "day", start: "09:00", end: "17:00", description: "GG-style day assignment" },
  { code: "OC", label: "On-call", band: "night", start: "00:00", end: "23:59", description: "On-call availability" },
];

export type OperationalBadgeGroup =
  | "leave"
  | "training"
  | "assignment"
  | "workflow"
  | "special";

export type OperationalBadgeDefinition = {
  code: string;
  label: string;
  group: OperationalBadgeGroup;
  /** Short hover detail */
  detail?: string;
  /** Compact text in calendar chips (full code stays canonical in data). */
  chipLabel?: string;
};

export const OPERATIONAL_BADGE_REGISTRY: Record<string, OperationalBadgeDefinition> = {
  TRN: { code: "TRN", label: "Training", group: "training", detail: "Training activity" },
  TRAINING: { code: "TRAINING", label: "Training", group: "training", detail: "Training overlay" },
  PTO: { code: "PTO", label: "Vacation", group: "leave", detail: "Paid time off / vacation" },
  SICK: { code: "SICK", label: "Sick", group: "leave", detail: "Sick leave" },
  LDT: { code: "LDT", label: "Light duty", group: "workflow", detail: "Light duty restriction" },
  SHDW: { code: "SHDW", label: "Shadowing", group: "training", detail: "Shadow / observation" },
  SHADOW: { code: "SHADOW", label: "Shadow", group: "training", detail: "Shadow / observation" },
  EVT: { code: "EVT", label: "Special event", group: "special", detail: "Special event coverage" },
  EVENT: { code: "EVENT", label: "Event", group: "special", detail: "Planned event or surge" },
  GG: { code: "GG", label: "Greenglade", group: "assignment", detail: "Greenglade facility assignment" },
  PMR: { code: "PMR", label: "Peer review", group: "workflow", detail: "Peer review pending" },
  OT: { code: "OT", label: "Overtime", group: "workflow", detail: "Overtime extension" },
  LEAD: { code: "LEAD", label: "Lead", group: "workflow", detail: "Lead responsibility" },
  RELIEF: { code: "RELIEF", label: "Relief", group: "workflow", detail: "Relief coverage" },
  COVERAGE: {
    code: "COVERAGE",
    label: "Coverage",
    group: "workflow",
    detail: "Extra coverage",
    chipLabel: "COV",
  },
  PROJECT: {
    code: "PROJECT",
    label: "Project",
    group: "assignment",
    detail: "Project focus",
    chipLabel: "PROJ",
  },
};

/** Label shown on small schedule chips; falls back to a short slice of the code. */
export function operationalBadgeChipLabel(code: string): string {
  const u = code.trim().toUpperCase();
  if (!u) return code;
  const def = OPERATIONAL_BADGE_REGISTRY[u];
  if (def?.chipLabel) return def.chipLabel;
  return u.length > 5 ? u.slice(0, 4) : u;
}

export type AvailabilityCellKind = "available" | "unavailable" | "restricted";

export type AvailabilityCellOverlay = "none" | "stripe-diagonal" | "edge-morning" | "edge-afternoon";

export type AvailabilityCellEvaluation = {
  kind: AvailabilityCellKind;
  overlay: AvailabilityCellOverlay;
  /** Drag allowed without manager override */
  dropAllowed: boolean;
  /** Needs override path when placement conflicts */
  needsOverrideForBand?: ShiftTypeKey;
  /** True when a manager may force placement (preference/band), false for hard blocks (PTO, unavailable). */
  managerOverrideEligible?: boolean;
  message: string;
};
