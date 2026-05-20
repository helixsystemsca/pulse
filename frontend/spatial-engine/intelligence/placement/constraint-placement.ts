import { extentSize } from "@/spatial-engine/document/extent";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import { clampPointToRect } from "@/spatial-engine/geometry/snap";
import {
  placementBlocked,
  validateInventoryPlacement,
} from "@/spatial-engine/intelligence/collision";
import type { InventoryPlacementRect } from "@/spatial-engine/intelligence/collision";
import { snapRectPlacement } from "@/spatial-engine/intelligence/placement/smart-snap";
import type { SmartSnapOptions, ValidPlacementRegion } from "@/spatial-engine/intelligence/placement/types";

export type ConstraintAwarePlacementInput = {
  x: number;
  y: number;
  width: number;
  height: number;
  id?: string;
};

export type ConstraintAwarePlacementResult = {
  x: number;
  y: number;
  valid: boolean;
  snappedX: boolean;
  snappedY: boolean;
  violations: ReturnType<typeof validateInventoryPlacement>["violations"];
};

/** Valid top-left region for a rect within workspace bounds. */
export function validPlacementRegion(doc: SpatialDocument, rectWidth: number, rectHeight: number): ValidPlacementRegion {
  const { width, height } = extentSize(doc.coordinateSpace.extent);
  const regionWidth = Math.max(0, width - rectWidth);
  const regionHeight = Math.max(0, height - rectHeight);
  return {
    region: { x: 0, y: 0, width: regionWidth, height: regionHeight },
    withinBounds: regionWidth > 0 && regionHeight > 0,
  };
}

/**
 * Constraint-aware placement: clamp to bounds, smart snap, then validate collisions.
 * Does not mutate the document — returns candidate coordinates only.
 */
export function resolveConstraintAwarePlacement(
  doc: SpatialDocument,
  input: ConstraintAwarePlacementInput,
  snapOptions: SmartSnapOptions,
): ConstraintAwarePlacementResult {
  const snapped = snapRectPlacement(input.x, input.y, input.width, input.height, doc, snapOptions);
  const rect: InventoryPlacementRect = {
    id: input.id,
    x: snapped.x,
    y: snapped.y,
    width: input.width,
    height: input.height,
  };
  const validation = validateInventoryPlacement(doc, rect, {
    excludeInventoryId: input.id,
    treatRestrictedAsWarning: true,
  });

  return {
    x: snapped.x,
    y: snapped.y,
    valid: validation.valid,
    snappedX: snapped.snappedX,
    snappedY: snapped.snappedY,
    violations: validation.violations,
  };
}

/** Nudge placement in small steps until valid or max iterations (deterministic spiral). */
export function nudgeToValidPlacement(
  doc: SpatialDocument,
  input: ConstraintAwarePlacementInput,
  snapOptions: SmartSnapOptions,
  maxSteps = 12,
  stepPx = 4,
): ConstraintAwarePlacementResult {
  let result = resolveConstraintAwarePlacement(doc, input, snapOptions);
  if (result.valid) return result;

  const offsets = [
    [stepPx, 0],
    [-stepPx, 0],
    [0, stepPx],
    [0, -stepPx],
    [stepPx, stepPx],
    [-stepPx, stepPx],
    [stepPx, -stepPx],
    [-stepPx, -stepPx],
  ];

  for (let i = 0; i < Math.min(maxSteps, offsets.length); i++) {
    const [dx, dy] = offsets[i]!;
    const { width, height } = extentSize(doc.coordinateSpace.extent);
    const clamped = clampPointToRect(
      result.x + dx,
      result.y + dy,
      input.width,
      input.height,
      width,
      height,
    );
    result = resolveConstraintAwarePlacement(
      doc,
      { ...input, x: clamped.x, y: clamped.y },
      snapOptions,
    );
    if (result.valid) return result;
  }

  return result;
}

export function isPlacementAllowed(
  doc: SpatialDocument,
  rect: InventoryPlacementRect,
  excludeInventoryId?: string,
): boolean {
  return !placementBlocked(doc, rect, { excludeInventoryId, treatRestrictedAsWarning: true });
}
