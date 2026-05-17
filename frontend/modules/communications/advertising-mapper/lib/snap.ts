import { clampPointToRect, clampSize, snapToGrid } from "@/spatial-engine/geometry/snap";

export function snapInches(value: number, gridInches: number, enabled: boolean): number {
  return snapToGrid(value, gridInches, enabled);
}

export function clampBlockToWall(
  x: number,
  y: number,
  width: number,
  height: number,
  wallWidth: number,
  wallHeight: number,
): { x: number; y: number } {
  return clampPointToRect(x, y, width, height, wallWidth, wallHeight);
}

export function clampBlockSize(
  width: number,
  height: number,
  minInches = 6,
  maxWidth?: number,
  maxHeight?: number,
): { width: number; height: number } {
  return clampSize(width, height, minInches, maxWidth, maxHeight);
}
