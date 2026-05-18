import { BASE_PX_PER_INCH, RULER_THICKNESS_PX, type PlannerViewport } from "@/modules/communications/advertising-mapper/lib/coordinates";
import { fitViewportToBounds } from "@/spatial-engine/viewport/fit";
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";

/** Fit the active wall into the drawable stage area. */
export function fitWallViewport(
  wall: FacilityWallPlan,
  stageWidth: number,
  stageHeight: number,
): PlannerViewport {
  return fitViewportToBounds({
    stageWidth,
    stageHeight,
    contentOffset: { x: RULER_THICKNESS_PX, y: RULER_THICKNESS_PX },
    bounds: {
      minX: 0,
      minY: 0,
      maxX: wall.width_inches * BASE_PX_PER_INCH,
      maxY: wall.height_inches * BASE_PX_PER_INCH,
    },
    padding: 48,
  });
}
