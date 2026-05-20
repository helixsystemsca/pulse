"use client";

import { useCallback } from "react";
import {
  BASE_PX_PER_INCH,
  RULER_THICKNESS_PX,
  VIEWPORT_SCALE_MAX,
  VIEWPORT_SCALE_MIN,
  type PlannerViewport,
} from "@/modules/communications/advertising-mapper/lib/coordinates";
import { useSpatialViewport } from "@/spatial-engine/hooks/useSpatialViewport";

const INITIAL: PlannerViewport = { scale: 1, panX: 24, panY: 24 };

export function usePlannerViewport(initial: PlannerViewport = INITIAL) {
  const base = useSpatialViewport({
    initial,
    contentOffset: { x: RULER_THICKNESS_PX, y: RULER_THICKNESS_PX },
    minScale: VIEWPORT_SCALE_MIN,
    maxScale: VIEWPORT_SCALE_MAX,
    basePxPerInch: BASE_PX_PER_INCH,
  });

  const zoomBy = useCallback(
    (factor: number, focalX: number, focalY: number, _originX: number, _originY: number) => {
      base.zoomBy(factor, focalX, focalY);
    },
    [base],
  );

  return { ...base, zoomBy };
}
