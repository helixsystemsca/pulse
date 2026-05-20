/**
 * Shared spatial engine types — domain-agnostic world space.
 * Konva and other renderers consume these; never persist Stage node JSON.
 */

/** Top-left origin, Y increases downward (canvas convention). */
export type WorldPoint = { x: number; y: number };

/** Flat polygon vertices: [x0, y0, x1, y1, …] in world units. */
export type FlatPolygonPoints = readonly number[];

export type WorldRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorldBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Pan + zoom applied to world content inside a stage/container. */
export type SpatialViewport = {
  scale: number;
  panX: number;
  panY: number;
};

/** Chrome offset between container origin and world layer (e.g. rulers). */
export type ContentOffset = {
  x: number;
  y: number;
};

/** Visible world rectangle for minimap / culling. */
export type VisibleWorldRect = WorldRect;

/** Stage dimensions + viewport snapshot (Konva overlay contract). */
export type StageViewportSnapshot = {
  stageWidth: number;
  stageHeight: number;
  viewport: SpatialViewport;
  contentOffset: ContentOffset;
};

export const DEFAULT_CONTENT_OFFSET: ContentOffset = { x: 0, y: 0 };

export const VIEWPORT_SCALE_MIN = 0.1;
export const VIEWPORT_SCALE_MAX = 8;
