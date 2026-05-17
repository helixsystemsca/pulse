import type { SpatialViewport } from "@/spatial-engine/types/spatial";
import { DEFAULT_INCH_BASE_PX_PER_INCH } from "@/spatial-engine/coordinates/inch-space";
import {
  canvasPxToInches as canvasPxToInchesEngine,
  clampViewportScale as clampScaleEngine,
  effectivePxPerInch,
  inchesToCanvasPx,
  screenToWorldInches as screenToWorldInchesEngine,
  wallCanvasSizePx,
  zoomInchViewportAtPoint,
} from "@/spatial-engine/viewport/inch-planner";

/** Base render scale: screen pixels per real-world inch at zoom 1. */
export const BASE_PX_PER_INCH = DEFAULT_INCH_BASE_PX_PER_INCH;

export const RULER_THICKNESS_PX = 28;

export type PlannerViewport = SpatialViewport;

export const VIEWPORT_SCALE_MIN = 0.35;
export const VIEWPORT_SCALE_MAX = 3.5;

export function clampViewportScale(scale: number): number {
  return clampScaleEngine(scale, VIEWPORT_SCALE_MIN, VIEWPORT_SCALE_MAX);
}

export { effectivePxPerInch, inchesToCanvasPx, wallCanvasSizePx };

export function canvasPxToInches(px: number, viewport: PlannerViewport): number {
  return canvasPxToInchesEngine(px, viewport, BASE_PX_PER_INCH);
}

export function screenToWorldInches(
  screenX: number,
  screenY: number,
  viewport: PlannerViewport,
  originX: number,
  originY: number,
): { x: number; y: number } {
  return screenToWorldInchesEngine(
    screenX,
    screenY,
    viewport,
    { x: originX, y: originY },
    BASE_PX_PER_INCH,
  );
}

export function zoomViewportAtPoint(
  viewport: PlannerViewport,
  focalScreenX: number,
  focalScreenY: number,
  originX: number,
  originY: number,
  scaleFactor: number,
): PlannerViewport {
  return zoomInchViewportAtPoint(
    viewport,
    focalScreenX,
    focalScreenY,
    { x: originX, y: originY },
    scaleFactor,
    BASE_PX_PER_INCH,
    VIEWPORT_SCALE_MIN,
    VIEWPORT_SCALE_MAX,
  );
}
