import type { FlatPolygonPoints } from "@/spatial-engine/types/spatial";
import {
  distance,
  flatFromPairs,
  isNearPoint,
  isValidClosedPolygon,
  MIN_POLYGON_VERTICES,
  pairsFromFlatPoints,
  pointInPolygon,
  rectCorners,
  rectsOverlap,
} from "@/spatial-engine/geometry/polygon";

export type PolygonPointsInches = FlatPolygonPoints;

export const CLOSE_POLYGON_THRESHOLD_INCHES = 8;

export {
  flatFromPairs,
  isNearPoint,
  isValidClosedPolygon,
  MIN_POLYGON_VERTICES,
  pairsFromFlatPoints,
  pointInPolygon,
  rectCorners,
  rectsOverlap,
};

export function distanceInches(ax: number, ay: number, bx: number, by: number): number {
  return distance(ax, ay, bx, by);
}
