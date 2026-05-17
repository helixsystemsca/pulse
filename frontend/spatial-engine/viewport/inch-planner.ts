import { createInchSpace, DEFAULT_INCH_BASE_PX_PER_INCH } from "@/spatial-engine/coordinates/inch-space";
import type { ContentOffset, SpatialViewport } from "@/spatial-engine/types/spatial";
import {
  clampViewportScale as clampViewportScaleCore,
  screenToWorld,
  zoomViewportAtScreenPoint,
} from "@/spatial-engine/viewport/transforms";

const inchSpaceCache = new Map<number, ReturnType<typeof createInchSpace>>();

function inchSpace(basePxPerInch: number) {
  let s = inchSpaceCache.get(basePxPerInch);
  if (!s) {
    s = createInchSpace(basePxPerInch);
    inchSpaceCache.set(basePxPerInch, s);
  }
  return s;
}

export function effectivePxPerInch(viewport: SpatialViewport, basePxPerInch = DEFAULT_INCH_BASE_PX_PER_INCH): number {
  return inchSpace(basePxPerInch).screenPixelsPerWorldUnit(viewport.scale);
}

export function inchesToCanvasPx(inches: number, viewport: SpatialViewport, basePxPerInch = DEFAULT_INCH_BASE_PX_PER_INCH): number {
  return inches * effectivePxPerInch(viewport, basePxPerInch);
}

export function canvasPxToInches(px: number, viewport: SpatialViewport, basePxPerInch = DEFAULT_INCH_BASE_PX_PER_INCH): number {
  const ppi = effectivePxPerInch(viewport, basePxPerInch);
  if (ppi <= 0) return 0;
  return px / ppi;
}

export function screenToWorldInches(
  screenX: number,
  screenY: number,
  viewport: SpatialViewport,
  contentOffset: ContentOffset,
  basePxPerInch = DEFAULT_INCH_BASE_PX_PER_INCH,
): { x: number; y: number } {
  return screenToWorld(screenX, screenY, viewport, inchSpace(basePxPerInch), contentOffset);
}

export function zoomInchViewportAtPoint(
  viewport: SpatialViewport,
  focalScreenX: number,
  focalScreenY: number,
  contentOffset: ContentOffset,
  scaleFactor: number,
  basePxPerInch = DEFAULT_INCH_BASE_PX_PER_INCH,
  minScale = 0.35,
  maxScale = 3.5,
): SpatialViewport {
  return zoomViewportAtScreenPoint(
    viewport,
    focalScreenX,
    focalScreenY,
    scaleFactor,
    inchSpace(basePxPerInch),
    contentOffset,
    minScale,
    maxScale,
  );
}

export function wallCanvasSizePx(
  wallWidthInches: number,
  wallHeightInches: number,
  viewport: SpatialViewport,
  basePxPerInch = DEFAULT_INCH_BASE_PX_PER_INCH,
): { width: number; height: number } {
  return {
    width: inchesToCanvasPx(wallWidthInches, viewport, basePxPerInch),
    height: inchesToCanvasPx(wallHeightInches, viewport, basePxPerInch),
  };
}

export function clampViewportScale(scale: number, minScale: number, maxScale: number): number {
  return clampViewportScaleCore(scale, minScale, maxScale);
}
