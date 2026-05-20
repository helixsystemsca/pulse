/** Discriminator for coordinate space implementations. */
export type CoordinateSpaceKind = "pixel" | "inch" | "calibrated";

/**
 * Converts between screen pixels (after pan/offset) and abstract world units.
 * Domains choose pixel vs inch vs calibrated semantics.
 */
export interface CoordinateSpaceAdapter {
  readonly kind: CoordinateSpaceKind;

  /** World units per screen pixel at the given viewport scale. */
  worldUnitsPerScreenPixel(viewportScale: number): number;

  /** Screen pixels per world unit at the given viewport scale. */
  screenPixelsPerWorldUnit(viewportScale: number): number;
}
