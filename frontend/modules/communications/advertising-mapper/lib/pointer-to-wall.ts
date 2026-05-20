import {
  BASE_PX_PER_INCH,
  RULER_THICKNESS_PX,
  type PlannerViewport,
} from "@/modules/communications/advertising-mapper/lib/coordinates";
import { pointerToWorld } from "@/spatial-engine/interactions/pointer";
import { createInchSpace } from "@/spatial-engine/coordinates/inch-space";

const inchSpace = createInchSpace(BASE_PX_PER_INCH);

export function pointerToWallInches(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  viewport: PlannerViewport,
): { x: number; y: number } {
  return pointerToWorld({
    screenX: clientX - containerRect.left,
    screenY: clientY - containerRect.top,
    viewport,
    space: inchSpace,
    contentOffset: { x: RULER_THICKNESS_PX, y: RULER_THICKNESS_PX },
  });
}
