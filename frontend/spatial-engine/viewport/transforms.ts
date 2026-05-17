import type { CoordinateSpaceAdapter } from "@/spatial-engine/coordinates/types";
import type { ContentOffset, SpatialViewport, VisibleWorldRect, WorldPoint } from "@/spatial-engine/types/spatial";

export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: SpatialViewport,
  space: CoordinateSpaceAdapter,
  contentOffset: ContentOffset = { x: 0, y: 0 },
): WorldPoint {
  const localX = screenX - contentOffset.x - viewport.panX;
  const localY = screenY - contentOffset.y - viewport.panY;
  const wpp = space.worldUnitsPerScreenPixel(viewport.scale);
  return { x: localX * wpp, y: localY * wpp };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: SpatialViewport,
  space: CoordinateSpaceAdapter,
  contentOffset: ContentOffset = { x: 0, y: 0 },
): { x: number; y: number } {
  const ppu = space.screenPixelsPerWorldUnit(viewport.scale);
  return {
    x: contentOffset.x + viewport.panX + worldX * ppu,
    y: contentOffset.y + viewport.panY + worldY * ppu,
  };
}

export function getVisibleWorldRect(
  stageWidth: number,
  stageHeight: number,
  viewport: SpatialViewport,
  space: CoordinateSpaceAdapter,
  contentOffset: ContentOffset = { x: 0, y: 0 },
): VisibleWorldRect {
  const topLeft = screenToWorld(contentOffset.x, contentOffset.y, viewport, space, contentOffset);
  const bottomRight = screenToWorld(
    contentOffset.x + stageWidth,
    contentOffset.y + stageHeight,
    viewport,
    space,
    contentOffset,
  );
  return {
    x: Math.min(topLeft.x, bottomRight.x),
    y: Math.min(topLeft.y, bottomRight.y),
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y),
  };
}

export function clampViewportScale(scale: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, scale));
}

/** Zoom toward a screen anchor; returns updated viewport. */
export function zoomViewportAtScreenPoint(
  viewport: SpatialViewport,
  screenX: number,
  screenY: number,
  factor: number,
  space: CoordinateSpaceAdapter,
  contentOffset: ContentOffset = { x: 0, y: 0 },
  minScale = 0.1,
  maxScale = 8,
): SpatialViewport {
  const world = screenToWorld(screenX, screenY, viewport, space, contentOffset);
  const newScale = clampViewportScale(viewport.scale * factor, minScale, maxScale);
  const ppu = space.screenPixelsPerWorldUnit(newScale);
  return {
    scale: newScale,
    panX: screenX - contentOffset.x - world.x * ppu,
    panY: screenY - contentOffset.y - world.y * ppu,
  };
}

export function panViewportBy(viewport: SpatialViewport, deltaScreenX: number, deltaScreenY: number): SpatialViewport {
  return {
    ...viewport,
    panX: viewport.panX + deltaScreenX,
    panY: viewport.panY + deltaScreenY,
  };
}
