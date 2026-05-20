import type { WorldBounds } from "@/spatial-engine/types/spatial";

export function extentWidth(extent: WorldBounds): number {
  return Math.max(0, extent.maxX - extent.minX);
}

export function extentHeight(extent: WorldBounds): number {
  return Math.max(0, extent.maxY - extent.minY);
}

export function extentSize(extent: WorldBounds): { width: number; height: number } {
  return { width: extentWidth(extent), height: extentHeight(extent) };
}
