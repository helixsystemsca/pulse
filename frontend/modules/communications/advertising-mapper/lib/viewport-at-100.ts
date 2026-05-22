import {
  BASE_PX_PER_INCH,
  RULER_THICKNESS_PX,
  type PlannerViewport,
} from "@/modules/communications/advertising-mapper/lib/coordinates";

/** Fixed 100% zoom — world inches map 1:1 to {@link BASE_PX_PER_INCH} screen pixels inside rulers. */
export function viewportAt100Percent(): PlannerViewport {
  return {
    scale: 1,
    panX: RULER_THICKNESS_PX,
    panY: RULER_THICKNESS_PX,
  };
}

export function drawablePixelsFromContainer(containerWidth: number, containerHeight: number): {
  widthPx: number;
  heightPx: number;
} {
  return {
    widthPx: Math.max(1, Math.floor(containerWidth) - RULER_THICKNESS_PX),
    heightPx: Math.max(1, Math.floor(containerHeight) - RULER_THICKNESS_PX),
  };
}

export function drawableInchesFromContainer(containerWidth: number, containerHeight: number): {
  width_inches: number;
  height_inches: number;
} {
  const { widthPx, heightPx } = drawablePixelsFromContainer(containerWidth, containerHeight);
  return {
    width_inches: roundInches(widthPx / BASE_PX_PER_INCH),
    height_inches: roundInches(heightPx / BASE_PX_PER_INCH),
  };
}

function roundInches(n: number): number {
  return Math.round(n * 100) / 100;
}
