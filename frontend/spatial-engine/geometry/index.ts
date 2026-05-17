export { polygonBBox, rectToBounds, unionBounds } from "@/spatial-engine/geometry/bbox";
export { rectIntersectsPolygon } from "@/spatial-engine/geometry/collision";
export {
  assertValidPolygon,
  copyFlatPoints,
  createPolygonId,
  moveVertexInFlatPoints,
  removePolygonVertex,
} from "@/spatial-engine/geometry/factory";
export {
  formatLinearDistance,
  feetToInches,
  inchesToFeet,
  INCHES_PER_FOOT,
  linearToDisplayValue,
  parseLinearInput,
  squareFeetFromRect,
  type LinearDisplayUnit,
} from "@/spatial-engine/geometry/measurements";
export {
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
export { clampPointToRect, clampSize, snapToGrid } from "@/spatial-engine/geometry/snap";
