/**
 * Advertisement-mapper collision rules — delegates to spatial-engine intelligence + geometry.
 */
import { validateInventoryPlacement } from "@/spatial-engine/intelligence/collision";
import { rectIntersectsPolygon } from "@/spatial-engine/geometry/collision";
import { facilityWallToSpatialDocument } from "@/modules/communications/advertising-mapper/lib/spatial-document";
import type { ConstraintRegion } from "@/modules/communications/advertising-mapper/geometry/types";
import type { FacilityWallPlan, InventoryBlock } from "@/modules/communications/advertising-mapper/types";

export type InventoryRectInches = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function inventoryToRectInches(block: InventoryBlock): InventoryRectInches {
  return {
    x: block.x,
    y: block.y,
    width: block.width_inches,
    height: block.height_inches,
  };
}

/** True when any part of the inventory rect overlaps the constraint polygon. */
export function inventoryIntersectsConstraint(
  inventory: InventoryBlock | InventoryRectInches,
  constraint: ConstraintRegion,
): boolean {
  const rect = "width_inches" in inventory ? inventoryToRectInches(inventory) : inventory;
  return rectIntersectsPolygon(rect, constraint.points);
}

export function inventoryViolatesBlockedConstraints(
  inventory: InventoryBlock,
  constraints: readonly ConstraintRegion[],
): ConstraintRegion[] {
  return constraints.filter(
    (c) => c.constraintType === "blocked" && inventoryIntersectsConstraint(inventory, c),
  );
}

/** Full placement validation via canonical SpatialDocument (Phase 4 collision engine). */
export function validateWallInventoryPlacement(
  wall: FacilityWallPlan,
  inventory: InventoryBlock | InventoryRectInches,
  options?: { excludeInventoryId?: string },
) {
  const doc = facilityWallToSpatialDocument(wall);
  const rect = "width_inches" in inventory ? inventoryToRectInches(inventory) : inventory;
  return validateInventoryPlacement(
    doc,
    { ...rect, id: "width_inches" in inventory ? inventory.id : options?.excludeInventoryId },
    { excludeInventoryId: options?.excludeInventoryId, treatRestrictedAsWarning: true },
  );
}
