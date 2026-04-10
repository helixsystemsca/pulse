import polyclip from "polygon-clipping";
import type { MultiPolygon, Polygon } from "polygon-clipping";
import type { BlueprintElement } from "@/components/zones-devices/blueprint-types";

function zonePolygonFlat(el: BlueprintElement): number[] | null {
  if (el.type !== "zone" || !el.path_points || el.path_points.length < 6) return null;
  return el.path_points;
}

/** World-space closed ring [x,y]... for polygon-clipping (explicitly closed). */
export function zoneToOuterRing(el: BlueprintElement): [number, number][] | null {
  if (el.type !== "zone") return null;

  const poly = zonePolygonFlat(el);
  if (poly) {
    const ring: [number, number][] = [];
    for (let i = 0; i + 1 < poly.length; i += 2) {
      ring.push([poly[i]!, poly[i + 1]!]);
    }
    if (ring.length < 3) return null;
    const f = ring[0]!;
    const l = ring[ring.length - 1]!;
    if (f[0] !== l[0] || f[1] !== l[1]) ring.push([f[0], f[1]]);
    return ring;
  }

  const rot = el.rotation ?? 0;
  const w = el.width ?? 120;
  const h = el.height ?? 80;
  const rad = (rot * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const world = corners.map(([lx, ly]): [number, number] => [
    el.x + lx * c - ly * s,
    el.y + lx * s + ly * c,
  ]);
  world.push([world[0]![0], world[0]![1]]);
  return world;
}

function polygonSignedAreaRing(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  let a = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const p1 = ring[i]!;
    const p2 = ring[(i + 1) % n]!;
    a += p1[0] * p2[1] - p2[0] * p1[1];
  }
  return a / 2;
}

function ringAbsoluteArea(ring: [number, number][]): number {
  return Math.abs(polygonSignedAreaRing(ring));
}

function pickLargestPolygon(mp: MultiPolygon): Polygon | null {
  let best: Polygon | null = null;
  let bestArea = 0;
  for (const poly of mp) {
    const outer = poly[0];
    if (!outer || outer.length < 4) continue;
    const area = ringAbsoluteArea(outer as [number, number][]);
    if (area > bestArea) {
      bestArea = area;
      best = poly;
    }
  }
  return best;
}

function ringToPathPoints(ring: [number, number][]): number[] | null {
  if (ring.length < 4) return null;
  /** Drop closing duplicate */
  const open = ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1] ? ring.slice(0, -1) : ring.slice();
  if (open.length < 3) return null;
  const flat: number[] = [];
  for (const p of open) {
    flat.push(p[0], p[1]);
  }
  return flat;
}

/**
 * Boolean union of two or more zones (rect or polygon). Returns a single zone element or null.
 * Overlapping regions merge into one outline; result may be a polygon even from rectangles.
 */
export function mergeZonesUnion(keepId: string, name: string, zones: BlueprintElement[]): BlueprintElement | null {
  const rings: [number, number][][] = [];
  for (const z of zones) {
    const r = zoneToOuterRing(z);
    if (r) rings.push(r);
  }
  if (rings.length < 2) return null;

  let acc: MultiPolygon = [[rings[0]!]];
  for (let i = 1; i < rings.length; i++) {
    acc = polyclip.union(acc, [[rings[i]!]]);
  }

  /** Disjoint footprints → multiple polygons; merging must be one combined shell. */
  if (acc.length !== 1) return null;

  const largest = pickLargestPolygon(acc);
  if (!largest || !largest[0]) return null;

  const outer = largest[0] as [number, number][];
  const flat = ringToPathPoints(outer);
  if (!flat || flat.length < 6) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const x = flat[i]!;
    const y = flat[i + 1]!;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const area = ringAbsoluteArea(outer);
  const isAxisRect = Math.abs(area - w * h) < 2;

  if (isAxisRect && (zones.every((z) => (z.rotation ?? 0) === 0) || w * h > 1)) {
    return {
      id: keepId,
      type: "zone",
      x: minX,
      y: minY,
      width: w,
      height: h,
      rotation: 0,
      name,
    };
  }

  return {
    id: keepId,
    type: "zone",
    x: minX,
    y: minY,
    width: w,
    height: h,
    rotation: 0,
    name,
    path_points: flat,
  };
}
