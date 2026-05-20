import type { SpatialViewport, WorldBounds } from "@/spatial-engine/types/spatial";
import { VIEWPORT_SCALE_MAX, VIEWPORT_SCALE_MIN } from "@/spatial-engine/types/spatial";

export type FitToBoundsOptions = {
  stageWidth: number;
  stageHeight: number;
  bounds: WorldBounds;
  contentOffset?: { x: number; y: number };
  padding?: number;
  minScale?: number;
  maxScale?: number;
};

/**
 * Compute viewport pan/scale so `bounds` fits inside the stage.
 * Centers content in the drawable area (after content offset).
 */
export function fitViewportToBounds(options: FitToBoundsOptions): SpatialViewport {
  const {
    stageWidth,
    stageHeight,
    bounds,
    contentOffset = { x: 0, y: 0 },
    padding = 56,
    minScale = VIEWPORT_SCALE_MIN,
    maxScale = VIEWPORT_SCALE_MAX,
  } = options;

  const bw = Math.max(40, bounds.maxX - bounds.minX);
  const bh = Math.max(40, bounds.maxY - bounds.minY);
  const drawableW = Math.max(1, stageWidth - contentOffset.x);
  const drawableH = Math.max(1, stageHeight - contentOffset.y);
  const sx = (drawableW - padding * 2) / bw;
  const sy = (drawableH - padding * 2) / bh;
  const scale = Math.max(minScale, Math.min(maxScale, Math.min(sx, sy)));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const centerScreenX = contentOffset.x + drawableW / 2;
  const centerScreenY = contentOffset.y + drawableH / 2;
  return {
    scale,
    panX: centerScreenX - cx * scale,
    panY: centerScreenY - cy * scale,
  };
}
