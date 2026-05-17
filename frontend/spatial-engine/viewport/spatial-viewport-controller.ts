import type { CoordinateSpaceAdapter } from "@/spatial-engine/coordinates/types";
import type { ContentOffset, SpatialViewport, StageViewportSnapshot, WorldBounds, WorldPoint } from "@/spatial-engine/types/spatial";
import { DEFAULT_CONTENT_OFFSET, VIEWPORT_SCALE_MAX, VIEWPORT_SCALE_MIN } from "@/spatial-engine/types/spatial";
import { fitViewportToBounds } from "@/spatial-engine/viewport/fit";
import {
  getVisibleWorldRect,
  panViewportBy,
  screenToWorld,
  worldToScreen,
  zoomViewportAtScreenPoint,
} from "@/spatial-engine/viewport/transforms";

export type SpatialViewportControllerOptions = {
  space: CoordinateSpaceAdapter;
  contentOffset?: ContentOffset;
  minScale?: number;
  maxScale?: number;
};

/**
 * Stateful viewport controller — unifies Drawings (Konva pos/scale) and
 * Advertisement Mapper (panX/panY + ruler offset) behind one API.
 */
export class SpatialViewportController {
  readonly space: CoordinateSpaceAdapter;
  readonly contentOffset: ContentOffset;
  readonly minScale: number;
  readonly maxScale: number;

  private _stageWidth = 0;
  private _stageHeight = 0;
  private _viewport: SpatialViewport = { scale: 1, panX: 0, panY: 0 };

  constructor(options: SpatialViewportControllerOptions) {
    this.space = options.space;
    this.contentOffset = options.contentOffset ?? DEFAULT_CONTENT_OFFSET;
    this.minScale = options.minScale ?? VIEWPORT_SCALE_MIN;
    this.maxScale = options.maxScale ?? VIEWPORT_SCALE_MAX;
  }

  get viewport(): SpatialViewport {
    return this._viewport;
  }

  get stageWidth(): number {
    return this._stageWidth;
  }

  get stageHeight(): number {
    return this._stageHeight;
  }

  setStageSize(width: number, height: number): void {
    this._stageWidth = width;
    this._stageHeight = height;
  }

  setViewport(viewport: SpatialViewport): void {
    this._viewport = { ...viewport };
  }

  /** Blueprint / Konva stage: pos + uniform scale. */
  static viewportFromKonvaStage(pos: { x: number; y: number }, scale: number): SpatialViewport {
    return { panX: pos.x, panY: pos.y, scale };
  }

  toKonvaStagePos(): { x: number; y: number } {
    return { x: this._viewport.panX, y: this._viewport.panY };
  }

  fitToBounds(bounds: WorldBounds, padding?: number): SpatialViewport {
    const next = fitViewportToBounds({
      stageWidth: this._stageWidth,
      stageHeight: this._stageHeight,
      bounds,
      contentOffset: this.contentOffset,
      padding,
      minScale: this.minScale,
      maxScale: this.maxScale,
    });
    this._viewport = next;
    return next;
  }

  screenToWorld(screenX: number, screenY: number): WorldPoint {
    return screenToWorld(screenX, screenY, this._viewport, this.space, this.contentOffset);
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return worldToScreen(worldX, worldY, this._viewport, this.space, this.contentOffset);
  }

  visibleWorldRect(): ReturnType<typeof getVisibleWorldRect> {
    return getVisibleWorldRect(
      this._stageWidth,
      this._stageHeight,
      this._viewport,
      this.space,
      this.contentOffset,
    );
  }

  zoomAt(screenX: number, screenY: number, factor: number): SpatialViewport {
    const next = zoomViewportAtScreenPoint(
      this._viewport,
      screenX,
      screenY,
      factor,
      this.space,
      this.contentOffset,
      this.minScale,
      this.maxScale,
    );
    this._viewport = next;
    return next;
  }

  panBy(deltaScreenX: number, deltaScreenY: number): SpatialViewport {
    const next = panViewportBy(this._viewport, deltaScreenX, deltaScreenY);
    this._viewport = next;
    return next;
  }

  snapshot(): StageViewportSnapshot {
    return {
      stageWidth: this._stageWidth,
      stageHeight: this._stageHeight,
      viewport: { ...this._viewport },
      contentOffset: { ...this.contentOffset },
    };
  }
}
