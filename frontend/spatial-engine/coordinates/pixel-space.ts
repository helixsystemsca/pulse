import type { CoordinateSpaceAdapter } from "@/spatial-engine/coordinates/types";

/** 1 world unit = 1 image pixel at viewport scale 1. */
export class PixelSpaceAdapter implements CoordinateSpaceAdapter {
  readonly kind = "pixel" as const;

  worldUnitsPerScreenPixel(viewportScale: number): number {
    if (viewportScale <= 0) return 0;
    return 1 / viewportScale;
  }

  screenPixelsPerWorldUnit(viewportScale: number): number {
    return Math.max(0, viewportScale);
  }
}

export const pixelSpace = new PixelSpaceAdapter();
