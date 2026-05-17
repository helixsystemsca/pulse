/** Base render scale: screen pixels per real-world inch at zoom 1. */
export const BASE_PX_PER_INCH = 6;

export const RULER_THICKNESS_PX = 28;

export type PlannerViewport = {
  scale: number;
  panX: number;
  panY: number;
};

export const VIEWPORT_SCALE_MIN = 0.35;
export const VIEWPORT_SCALE_MAX = 3.5;

export function clampViewportScale(scale: number): number {
  return Math.min(VIEWPORT_SCALE_MAX, Math.max(VIEWPORT_SCALE_MIN, scale));
}

export function effectivePxPerInch(viewport: PlannerViewport): number {
  return BASE_PX_PER_INCH * viewport.scale;
}

export function inchesToCanvasPx(inches: number, viewport: PlannerViewport): number {
  return inches * effectivePxPerInch(viewport);
}

export function canvasPxToInches(px: number, viewport: PlannerViewport): number {
  const ppi = effectivePxPerInch(viewport);
  if (ppi <= 0) return 0;
  return px / ppi;
}

/** Convert screen pointer position to wall inches (origin top-left). */
export function screenToWorldInches(
  screenX: number,
  screenY: number,
  viewport: PlannerViewport,
  originX: number,
  originY: number,
): { x: number; y: number } {
  const localX = screenX - originX - viewport.panX;
  const localY = screenY - originY - viewport.panY;
  return {
    x: canvasPxToInches(localX, viewport),
    y: canvasPxToInches(localY, viewport),
  };
}

/** Zoom toward a screen-space focal point (e.g. cursor). */
export function zoomViewportAtPoint(
  viewport: PlannerViewport,
  focalScreenX: number,
  focalScreenY: number,
  originX: number,
  originY: number,
  scaleFactor: number,
): PlannerViewport {
  const nextScale = clampViewportScale(viewport.scale * scaleFactor);
  if (nextScale === viewport.scale) return viewport;

  const worldX = canvasPxToInches(focalScreenX - originX - viewport.panX, viewport);
  const worldY = canvasPxToInches(focalScreenY - originY - viewport.panY, viewport);

  const next: PlannerViewport = { scale: nextScale, panX: 0, panY: 0 };
  const ppi = effectivePxPerInch(next);
  next.panX = focalScreenX - originX - worldX * ppi;
  next.panY = focalScreenY - originY - worldY * ppi;
  return next;
}

export function wallCanvasSizePx(
  wallWidthInches: number,
  wallHeightInches: number,
  viewport: PlannerViewport,
): { width: number; height: number } {
  return {
    width: inchesToCanvasPx(wallWidthInches, viewport),
    height: inchesToCanvasPx(wallHeightInches, viewport),
  };
}
