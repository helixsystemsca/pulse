import { isValidClosedPolygon, MIN_POLYGON_VERTICES } from "@/spatial-engine/geometry/polygon";
import type { FlatPolygonPoints } from "@/spatial-engine/types/spatial";

export function moveVertexInFlatPoints(
  points: FlatPolygonPoints,
  vertexIndex: number,
  x: number,
  y: number,
): number[] {
  const next = [...points];
  const i = vertexIndex * 2;
  if (i < 0 || i + 1 >= next.length) return next;
  next[i] = x;
  next[i + 1] = y;
  return next;
}

/** Remove vertex at index; returns null if below minimum vertices. */
export function removePolygonVertex(points: FlatPolygonPoints, vertexIndex: number): number[] | null {
  const next: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    if (i / 2 === vertexIndex) continue;
    next.push(points[i]!, points[i + 1]!);
  }
  if (next.length < MIN_POLYGON_VERTICES * 2) return null;
  return next;
}

export function copyFlatPoints(points: FlatPolygonPoints): number[] {
  return [...points];
}

export function createPolygonId(prefix = "polygon"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function assertValidPolygon(points: FlatPolygonPoints): boolean {
  return isValidClosedPolygon(points);
}
