import type { CoordinateSpaceAdapter } from "@/spatial-engine/coordinates/types";
import type { ContentOffset, SpatialViewport } from "@/spatial-engine/types/spatial";
import { screenToWorld } from "@/spatial-engine/viewport/transforms";

export type PointerWorldInput = {
  screenX: number;
  screenY: number;
  viewport: SpatialViewport;
  space: CoordinateSpaceAdapter;
  contentOffset?: ContentOffset;
};

/** Convert stage/container pointer coordinates to world space. */
export function pointerToWorld(input: PointerWorldInput): { x: number; y: number } {
  return screenToWorld(
    input.screenX,
    input.screenY,
    input.viewport,
    input.space,
    input.contentOffset ?? { x: 0, y: 0 },
  );
}

/** Konva stage pointer helper — uses stage-relative pointer position. */
export function konvaPointerToWorld(
  stagePointer: { x: number; y: number } | null | undefined,
  viewport: SpatialViewport,
  space: CoordinateSpaceAdapter,
  contentOffset?: ContentOffset,
): { x: number; y: number } | null {
  if (!stagePointer) return null;
  return pointerToWorld({
    screenX: stagePointer.x,
    screenY: stagePointer.y,
    viewport,
    space,
    contentOffset,
  });
}
