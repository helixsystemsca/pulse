/**
 * Shared spatial engine — viewport, coordinates, geometry, layers, tools, selection.
 * Domain business logic stays in drawings/ and advertising-mapper/.
 */

export * from "@/spatial-engine/document";
export * from "@/spatial-engine/persistence";
export * from "@/spatial-engine/workspace";
export * from "@/spatial-engine/coordinates";
export * from "@/spatial-engine/geometry";
export * from "@/spatial-engine/hooks";
export * from "@/spatial-engine/interactions";
export * from "@/spatial-engine/konva";
export * from "@/spatial-engine/layers";
export * from "@/spatial-engine/selection";
export * from "@/spatial-engine/tools";
export * from "@/spatial-engine/types/spatial";
export * from "@/spatial-engine/viewport";
export {
  canvasPxToInches,
  effectivePxPerInch,
  inchesToCanvasPx,
  screenToWorldInches,
  wallCanvasSizePx,
  zoomInchViewportAtPoint,
} from "@/spatial-engine/viewport/inch-planner";
