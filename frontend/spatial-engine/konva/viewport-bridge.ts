import type { SpatialViewport } from "@/spatial-engine/types/spatial";
import { SpatialViewportController } from "@/spatial-engine/viewport/spatial-viewport-controller";

/** Drawings / Blueprint Konva stage snapshot. */
export type KonvaStageViewport = {
  width: number;
  height: number;
  pos: { x: number; y: number };
  scale: number;
};

export function spatialViewportFromKonva(stage: Pick<KonvaStageViewport, "pos" | "scale">): SpatialViewport {
  return SpatialViewportController.viewportFromKonvaStage(stage.pos, stage.scale);
}

export function konvaStageFromSpatial(viewport: SpatialViewport): Pick<KonvaStageViewport, "pos" | "scale"> {
  return {
    pos: { x: viewport.panX, y: viewport.panY },
    scale: viewport.scale,
  };
}

export function konvaPointerToWorldFromStage(
  pointer: { x: number; y: number } | null | undefined,
  stageViewport: KonvaStageViewport,
): { x: number; y: number } | null {
  if (!pointer) return null;
  const vp = spatialViewportFromKonva(stageViewport);
  return {
    x: (pointer.x - vp.panX) / vp.scale,
    y: (pointer.y - vp.panY) / vp.scale,
  };
}
