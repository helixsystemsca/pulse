import type { ConstraintRegion, ConstraintType, PolygonPointsInches } from "@/modules/communications/advertising-mapper/geometry/types";
import { isValidClosedPolygon } from "@/modules/communications/advertising-mapper/geometry/polygon-math";
import {
  createPolygonId,
  moveVertexInFlatPoints,
  removePolygonVertex,
} from "@/spatial-engine/geometry/factory";

export function createConstraintRegion(
  points: PolygonPointsInches,
  constraintType: ConstraintType,
  partial?: Partial<Pick<ConstraintRegion, "label" | "notes">>,
): ConstraintRegion | null {
  if (!isValidClosedPolygon(points)) return null;
  const now = new Date().toISOString();
  return {
    id: createPolygonId("constraint"),
    type: "polygon",
    constraintType,
    points: [...points],
    label: partial?.label,
    notes: partial?.notes,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateConstraintPoints(region: ConstraintRegion, points: PolygonPointsInches): ConstraintRegion {
  return {
    ...region,
    points: [...points],
    updatedAt: new Date().toISOString(),
  };
}

export function moveAnchorInPoints(
  points: PolygonPointsInches,
  vertexIndex: number,
  x: number,
  y: number,
): number[] {
  return moveVertexInFlatPoints(points, vertexIndex, x, y);
}

export { removePolygonVertex };
