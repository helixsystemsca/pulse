import type { ConstraintRegion, PlannerToolMode } from "@/modules/communications/advertising-mapper/geometry/types";

export type ConstraintRevealMode = "edit" | "placement" | false;

/** When constraint overlays are shown on the canvas. */
export function constraintRevealMode(opts: {
  toolMode: PlannerToolMode;
  inventoryDragActive: boolean;
}): ConstraintRevealMode {
  if (opts.toolMode === "constraint") return "edit";
  if (opts.toolMode === "inventory" || opts.inventoryDragActive) return "placement";
  return false;
}

/**
 * Constraints drawn while placing or moving inventory.
 * Includes mountable zones plus blocked/restricted for collision context.
 */
export function constraintsForPlacementReveal(
  constraints: readonly ConstraintRegion[],
): ConstraintRegion[] {
  return constraints.filter((c) =>
    ["mountable", "premium_visibility", "restricted", "blocked", "curved_surface", "electrical_access"].includes(
      c.constraintType,
    ),
  );
}
