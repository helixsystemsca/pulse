import type { CoordinateSpaceAdapter } from "@/spatial-engine/coordinates/types";
import { InchSpaceAdapter } from "@/spatial-engine/coordinates/inch-space";

export type CalibrationReference = {
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  realWorldDistance: number;
};

export type CalibratedSpaceOptions = {
  /** Pixel distance between calibration points in image/world pixel space. */
  pixelDistanceBetweenPoints: number;
  /** Real-world distance between the same points (same unit as domain, typically inches). */
  realWorldDistance: number;
  /** Optional inch rendering density after calibration is applied. */
  basePixelsPerInch?: number;
};

/**
 * Stub for Phase 2+ — derives scale from two known points.
 * Until full UI exists, delegates screen conversion through derived inch adapter.
 */
export class CalibratedSpaceAdapter implements CoordinateSpaceAdapter {
  readonly kind = "calibrated" as const;
  readonly calibration: CalibrationReference;
  private readonly inchDelegate: InchSpaceAdapter;
  readonly worldUnitsPerPixel: number;

  constructor(options: CalibratedSpaceOptions) {
    const px = Math.max(1e-6, options.pixelDistanceBetweenPoints);
    const rw = Math.max(1e-6, options.realWorldDistance);
    this.worldUnitsPerPixel = rw / px;
    this.calibration = {
      pointA: { x: 0, y: 0 },
      pointB: { x: px, y: 0 },
      realWorldDistance: rw,
    };
    const basePx = options.basePixelsPerInch ?? 1 / this.worldUnitsPerPixel;
    this.inchDelegate = new InchSpaceAdapter({ basePixelsPerInch: basePx });
  }

  static fromReference(ref: CalibrationReference, pixelDistance: number, basePixelsPerInch?: number): CalibratedSpaceAdapter {
    return new CalibratedSpaceAdapter({
      pixelDistanceBetweenPoints: pixelDistance,
      realWorldDistance: ref.realWorldDistance,
      basePixelsPerInch,
    });
  }

  worldUnitsPerScreenPixel(viewportScale: number): number {
    return this.inchDelegate.worldUnitsPerScreenPixel(viewportScale);
  }

  screenPixelsPerWorldUnit(viewportScale: number): number {
    return this.inchDelegate.screenPixelsPerWorldUnit(viewportScale);
  }
}
