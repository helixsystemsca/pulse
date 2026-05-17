/**
 * Advertisement-mapper collision rules — uses shared spatial-engine geometry.
 */
import { rectIntersectsPolygon } from "@/spatial-engine/geometry/collision";
import type { ConstraintRegion } from "@/modules/communications/advertising-mapper/geometry/types";
import type { InventoryBlock } from "@/modules/communications/advertising-mapper/types";

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
