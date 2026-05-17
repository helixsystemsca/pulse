import type { FlatPolygonPoints } from "@/spatial-engine/types/spatial";

export const MIN_POLYGON_VERTICES = 3;

export function pairsFromFlatPoints(points: FlatPolygonPoints): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i += 2) {
    out.push({ x: points[i]!, y: points[i + 1]! });
  }
  return out;
}

export function flatFromPairs(pairs: readonly { x: number; y: number }[]): number[] {
  return pairs.flatMap((p) => [p.x, p.y]);
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function isNearPoint(ax: number, ay: number, bx: number, by: number, threshold: number): boolean {
  return distance(ax, ay, bx, by) <= threshold;
}

export function isValidClosedPolygon(points: FlatPolygonPoints): boolean {
  return pairsFromFlatPoints(points).length >= MIN_POLYGON_VERTICES;
}

/** Ray-casting point-in-polygon. */
export function pointInPolygon(x: number, y: number, points: FlatPolygonPoints): boolean {
  const verts = pairsFromFlatPoints(points);
  if (verts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i]!.x;
    const yi = verts[i]!.y;
    const xj = verts[j]!.x;
    const yj = verts[j]!.y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function rectCorners(x: number, y: number, width: number, height: number): { x: number; y: number }[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
