/**
 * Flyout / side-nav feature keys controllable in Team Management matrix.
 * Parent contract modules imply these keys are licensable (toggleable), not auto-enabled.
 */
import type { CanonicalFeatureKey } from "@/lib/features/canonical-features";

/** Granular keys aligned with `master-feature-registry` nav rows. */
export const NAV_MATRIX_FEATURE_KEYS = [
  "schedule_availability",
  "schedule_coverage",
  "schedule_shift_definitions",
  "pm_workspace",
  "pm_planning",
  "standards_my_procedures",
  "standards_routines",
  "standards_acknowledgments",
  "facilities_spatial",
  "spatial_infrastructure",
] as const satisfies readonly CanonicalFeatureKey[];

export type NavMatrixFeatureKey = (typeof NAV_MATRIX_FEATURE_KEYS)[number];

/** When a contract module is on, these matrix keys may be toggled (defaults remain off until enabled). */
export const MATRIX_LICENSABLE_CHILDREN: Partial<Record<string, readonly CanonicalFeatureKey[]>> = {
  schedule: [
    "schedule",
    "schedule_availability",
    "schedule_coverage",
    "schedule_shift_definitions",
  ],
  projects: ["projects", "pm_workspace", "pm_planning"],
  procedures: [
    "procedures",
    "standards_training",
    "standards_certifications",
    "standards_compliance",
    "standards_my_procedures",
    "standards_routines",
    "standards_acknowledgments",
  ],
  drawings: ["drawings", "facilities_spatial", "spatial_infrastructure"],
  dashboard: [
    "dashboard",
    "dashboard_operations",
    "dashboard_leadership",
    "dashboard_project",
    "dashboard_inspections",
    "dashboard_team_insights",
    "dashboard_kiosk",
    "dashboard_dept_communications",
    "dashboard_dept_aquatics",
    "dashboard_dept_reception",
    "dashboard_dept_fitness",
    "dashboard_dept_racquets",
    "dashboard_dept_admin",
  ],
};

export function expandMatrixLicensableKeys(rawCatalog: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of rawCatalog) {
    const t = String(raw).trim();
    if (!t) continue;
    out.add(t);
    const children = MATRIX_LICENSABLE_CHILDREN[t];
    if (children) {
      for (const c of children) out.add(c);
    }
  }
  return out;
}
