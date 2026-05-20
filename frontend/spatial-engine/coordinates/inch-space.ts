import type { CoordinateSpaceAdapter } from "@/spatial-engine/coordinates/types";

export type InchSpaceOptions = {
  /** Screen pixels representing one inch at viewport scale 1. */
  basePixelsPerInch: number;
};

/** World units are inches; rendering uses `basePixelsPerInch` at scale 1. */
export class InchSpaceAdapter implements CoordinateSpaceAdapter {
  readonly kind = "inch" as const;
  readonly basePixelsPerInch: number;

  constructor(options: InchSpaceOptions) {
    this.basePixelsPerInch = Math.max(1e-6, options.basePixelsPerInch);
  }

  worldUnitsPerScreenPixel(viewportScale: number): number {
    const pxPerInch = this.basePixelsPerInch * Math.max(viewportScale, 0);
    if (pxPerInch <= 0) return 0;
    return 1 / pxPerInch;
  }

  screenPixelsPerWorldUnit(viewportScale: number): number {
    return this.basePixelsPerInch * Math.max(viewportScale, 0);
  }
}

/** Default used by advertisement-mapper (6px per inch at scale 1). */
export const DEFAULT_INCH_BASE_PX_PER_INCH = 6;

export function createInchSpace(basePixelsPerInch = DEFAULT_INCH_BASE_PX_PER_INCH): InchSpaceAdapter {
  return new InchSpaceAdapter({ basePixelsPerInch });
}
