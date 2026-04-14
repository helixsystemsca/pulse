import polyclip from "polygon-clipping";
import type { MultiPolygon, Polygon } from "polygon-clipping";
import type { BlueprintElement } from "@/components/zones-devices/blueprint-types";
import { zoneToOuterRing } from "@/lib/blueprint-zone-union";

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
  const open =
    ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1]
      ? ring.slice(0, -1)
      : ring.slice();
  if (open.length < 3) return null;
  const flat: number[] = [];
  for (const p of open) {
    flat.push(p[0], p[1]);
  }
  return flat;
}

function pathPolygonToRing(el: BlueprintElement): [number, number][] | null {
  if ((el.type !== "path" && el.type !== "polygon") || !el.path_points || el.path_points.length < 6) return null;
  const poly = el.path_points;
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

function rectLikeToRing(el: BlueprintElement): [number, number][] | null {
  if (el.type !== "rectangle" && el.type !== "ellipse") return null;
  const w = el.width ?? 0;
  const h = el.height ?? 0;
  if (w <= 1 || h <= 1) return null;
  const rot = el.rotation ?? 0;
  const rad = (rot * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);

  if (el.type === "rectangle") {
    const corners: [number, number][] = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ];
    const world = corners.map(([lx, ly]): [number, number] => [el.x + lx * c - ly * s, el.y + lx * s + ly * c]);
    world.push([world[0]![0], world[0]![1]]);
    return world;
  }

  const segs = 48;
  const ring: [number, number][] = [];
  const cx = el.x + w / 2;
  const cy = el.y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * Math.PI * 2;
    const lx = rx * Math.cos(t);
    const ly = ry * Math.sin(t);
    ring.push([cx + lx * c - ly * s, cy + lx * s + ly * c]);
  }
  return ring;
}

/**
 * Closed outer ring for boolean union (path / polygon / zone / rectangle / ellipse).
 */
export function closedShapeToOuterRing(el: BlueprintElement): [number, number][] | null {
  if (el.type === "zone") return zoneToOuterRing(el);
  const pp = pathPolygonToRing(el);
  if (pp) return pp;
  return rectLikeToRing(el);
}

/**
 * Boolean union of two or more closed shapes into a single `path` outline (interiors / shared edges removed).
 * Returns null if inputs overlap only as disjoint pieces (multi-polygon result).
 */
export function mergeClosedShapesUnion(
  keepId: string,
  name: string,
  shapes: BlueprintElement[],
): BlueprintElement | null {
  const rings: [number, number][][] = [];
  for (const z of shapes) {
    const r = closedShapeToOuterRing(z);
    if (r) rings.push(r);
  }
  if (rings.length < 2) return null;

  let acc: MultiPolygon = [[rings[0]!]];
  for (let i = 1; i < rings.length; i++) {
    acc = polyclip.union(acc, [[rings[i]!]]);
  }

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

  return {
    id: keepId,
    type: "path",
    x: minX,
    y: minY,
    width: w,
    height: h,
    rotation: 0,
    name,
    path_points: flat,
  };
}
