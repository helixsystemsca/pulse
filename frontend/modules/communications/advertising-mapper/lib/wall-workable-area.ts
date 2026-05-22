import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";

/** Long edge of the workable wall in inches (~11′) — matches typical phone photo proportions. */
export const WORKABLE_LONG_EDGE_INCHES = 132;

/** Default portrait workable size (9∶16) when no photo is loaded. */
export const DEFAULT_WORKABLE_WIDTH_INCHES = 74;
export const DEFAULT_WORKABLE_HEIGHT_INCHES = WORKABLE_LONG_EDGE_INCHES;

/**
 * Map image pixel dimensions to wall inches, preserving aspect ratio.
 * The longer image edge maps to {@link WORKABLE_LONG_EDGE_INCHES}.
 */
export function wallInchesFromBackdropPixels(
  naturalWidth: number,
  naturalHeight: number,
  opts?: { longEdgeInches?: number },
): { width_inches: number; height_inches: number } {
  const longEdge = opts?.longEdgeInches ?? WORKABLE_LONG_EDGE_INCHES;
  const w = Math.max(1, naturalWidth);
  const h = Math.max(1, naturalHeight);
  const maxPx = Math.max(w, h);
  const widthInches = (w / maxPx) * longEdge;
  const heightInches = (h / maxPx) * longEdge;
  return {
    width_inches: roundInches(widthInches),
    height_inches: roundInches(heightInches),
  };
}

/** Sync wall footprint to an uploaded backdrop (or stored natural size). */
export function syncWallWorkableInchesFromBackdrop<T extends FacilityWallPlan>(wall: T): T {
  if (!wall.backdropUrl || !wall.backdropNaturalWidth || !wall.backdropNaturalHeight) {
    return wall;
  }
  const inches = wallInchesFromBackdropPixels(wall.backdropNaturalWidth, wall.backdropNaturalHeight);
  return { ...wall, ...inches };
}

function roundInches(n: number): number {
  return Math.round(n * 10) / 10;
}
