"use client";

import { useCallback, useState } from "react";
import type { ContentOffset, SpatialViewport } from "@/spatial-engine/types/spatial";
import { panViewportBy } from "@/spatial-engine/viewport/transforms";
import { clampViewportScale, zoomInchViewportAtPoint } from "@/spatial-engine/viewport/inch-planner";

export type UseSpatialViewportOptions = {
  initial?: SpatialViewport;
  contentOffset?: ContentOffset;
  minScale?: number;
  maxScale?: number;
  basePxPerInch?: number;
};

const DEFAULT_INITIAL: SpatialViewport = { scale: 1, panX: 24, panY: 24 };

/**
 * React hook for pan/zoom state. Inch helpers use optional content offset (rulers).
 * Pixel-space domains can pass contentOffset {0,0} and use SpatialViewportController directly.
 */
export function useSpatialViewport(options: UseSpatialViewportOptions = {}) {
  const {
    initial = DEFAULT_INITIAL,
    contentOffset = { x: 0, y: 0 },
    minScale = 0.35,
    maxScale = 3.5,
    basePxPerInch,
  } = options;

  const [viewport, setViewport] = useState<SpatialViewport>(initial);

  const setScale = useCallback(
    (scale: number) => {
      setViewport((v) => ({ ...v, scale: clampViewportScale(scale, minScale, maxScale) }));
    },
    [minScale, maxScale],
  );

  const zoomBy = useCallback(
    (factor: number, focalX: number, focalY: number) => {
      setViewport((v) =>
        zoomInchViewportAtPoint(
          v,
          focalX,
          focalY,
          contentOffset,
          factor,
          basePxPerInch,
          minScale,
          maxScale,
        ),
      );
    },
    [basePxPerInch, contentOffset, minScale, maxScale],
  );

  const panBy = useCallback((dx: number, dy: number) => {
    setViewport((v) => panViewportBy(v, dx, dy));
  }, []);

  const resetView = useCallback(() => {
    setViewport(initial);
  }, [initial]);

  return { viewport, setViewport, setScale, zoomBy, panBy, resetView };
}
