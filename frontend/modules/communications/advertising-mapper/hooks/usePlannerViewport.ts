"use client";

import { useCallback, useState } from "react";
import {
  clampViewportScale,
  zoomViewportAtPoint,
  type PlannerViewport,
} from "@/modules/communications/advertising-mapper/lib/coordinates";

const INITIAL: PlannerViewport = { scale: 1, panX: 24, panY: 24 };

export function usePlannerViewport(initial: PlannerViewport = INITIAL) {
  const [viewport, setViewport] = useState<PlannerViewport>(initial);

  const setScale = useCallback((scale: number) => {
    setViewport((v) => ({ ...v, scale: clampViewportScale(scale) }));
  }, []);

  const zoomBy = useCallback(
    (factor: number, focalX: number, focalY: number, originX: number, originY: number) => {
      setViewport((v) => zoomViewportAtPoint(v, focalX, focalY, originX, originY, factor));
    },
    [],
  );

  const panBy = useCallback((dx: number, dy: number) => {
    setViewport((v) => ({ ...v, panX: v.panX + dx, panY: v.panY + dy }));
  }, []);

  const resetView = useCallback(() => {
    setViewport(initial);
  }, [initial]);

  return { viewport, setViewport, setScale, zoomBy, panBy, resetView };
}
