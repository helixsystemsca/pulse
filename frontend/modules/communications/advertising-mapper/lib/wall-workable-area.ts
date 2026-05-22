import { BASE_PX_PER_INCH } from "@/modules/communications/advertising-mapper/lib/coordinates";
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

/** Wall size in inches so the workable area matches drawable pixels at 100% zoom. */
export function wallInchesFromDrawablePixels(
  widthPx: number,
  heightPx: number,
): { width_inches: number; height_inches: number } {
  return {
    width_inches: roundInches(Math.max(1, widthPx) / BASE_PX_PER_INCH),
    height_inches: roundInches(Math.max(1, heightPx) / BASE_PX_PER_INCH),
  };
}

/** Rescale blocks and constraints when the wall footprint changes (e.g. viewport resize). */
export function rescaleWallPlanToInches(
  wall: FacilityWallPlan,
  newWidthInches: number,
  newHeightInches: number,
): Pick<FacilityWallPlan, "width_inches" | "height_inches" | "blocks" | "constraints"> {
  const oldW = Math.max(1e-6, wall.width_inches);
  const oldH = Math.max(1e-6, wall.height_inches);
  const sx = newWidthInches / oldW;
  const sy = newHeightInches / oldH;
  return {
    width_inches: newWidthInches,
    height_inches: newHeightInches,
    blocks: wall.blocks.map((b) => ({
      ...b,
      x: b.x * sx,
      y: b.y * sy,
      width_inches: b.width_inches * sx,
      height_inches: b.height_inches * sy,
    })),
    constraints: wall.constraints.map((c) => ({
      ...c,
      points: c.points.map((p, i) => (i % 2 === 0 ? p * sx : p * sy)),
    })),
  };
}

function roundInches(n: number): number {
  return Math.round(n * 100) / 100;
}
