/**
 * Orthogonal routing between blueprint connectable elements (symbols, devices, groups).
 */

import type { BlueprintElement, ConnectionStyle } from "@/components/zones-devices/blueprint-types";
import { DEVICE_DEFAULT, GRID, SYMBOL_DEFAULT, elementWorldAabb } from "@/lib/blueprint-layout";
import { isBlueprintElementEffectivelyLocked } from "@/lib/blueprint-groups";

const ANCHOR_OUTSET = 8;
const OBSTACLE_PADDING = 6;
const CONNECT_MARGIN = 10;

export type ConnectableKind = "symbol" | "device" | "group";

export function isBlueprintConnectEndpoint(el: BlueprintElement): el is BlueprintElement & { type: ConnectableKind } {
  return el.type === "symbol" || el.type === "device" || el.type === "group";
}

/** Undirected pair key for duplicate connection detection. */
export function blueprintConnectionPairKey(a: string, b: string): string {
  return a < b ? `${a}\n${b}` : `${b}\n${a}`;
}

export function existingConnectionPairKeys(elements: BlueprintElement[]): Set<string> {
  const s = new Set<string>();
  for (const el of elements) {
    if (el.type !== "connection") continue;
    const from = el.connection_from;
    const to = el.connection_to;
    if (from && to) s.add(blueprintConnectionPairKey(from, to));
  }
  return s;
}

function snapScalar(v: number, useGrid: boolean): number {
  if (!useGrid) return v;
  return Math.round(v / GRID) * GRID;
}

function snapPoint(x: number, y: number, useGrid: boolean): { x: number; y: number } {
  return { x: snapScalar(x, useGrid), y: snapScalar(y, useGrid) };
}

export type Anchor = { x: number; y: number };

function elementObstacleAabb(
  el: BlueprintElement,
): { L: number; R: number; T: number; B: number } | null {
  const a = elementWorldAabb(el);
  if (!a) return null;
  return {
    L: a.L - OBSTACLE_PADDING,
    R: a.R + OBSTACLE_PADDING,
    T: a.T - OBSTACLE_PADDING,
    B: a.B + OBSTACLE_PADDING,
  };
}

function anchorsForElement(aabb: { L: number; R: number; T: number; B: number }): Anchor[] {
  const { L, R, T, B } = aabb;
  const cx = (L + R) / 2;
  const cy = (T + B) / 2;
  return [
    { x: cx, y: T - ANCHOR_OUTSET },
    { x: cx, y: B + ANCHOR_OUTSET },
    { x: L - ANCHOR_OUTSET, y: cy },
    { x: R + ANCHOR_OUTSET, y: cy },
  ];
}

function segmentIntersectsAabb(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  L: number,
  R: number,
  T: number,
  B: number,
): boolean {
  if (Math.abs(x1 - x2) < 1e-9) {
    const ymin = Math.min(y1, y2);
    const ymax = Math.max(y1, y2);
    return x1 >= L && x1 <= R && ymax >= T && ymin <= B;
  }
  if (Math.abs(y1 - y2) < 1e-9) {
    const xmin = Math.min(x1, x2);
    const xmax = Math.max(x1, x2);
    return y1 >= T && y1 <= B && xmax >= L && xmin <= R;
  }
  return false;
}

function segmentCrossesObstacles(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: { L: number; R: number; T: number; B: number }[],
): number {
  let n = 0;
  for (const o of obstacles) {
    if (segmentIntersectsAabb(x1, y1, x2, y2, o.L, o.R, o.T, o.B)) n++;
  }
  return n;
}

function pathLength(flat: number[]): number {
  let len = 0;
  for (let i = 0; i + 3 < flat.length; i += 2) {
    const x0 = flat[i]!;
    const y0 = flat[i + 1]!;
    const x1 = flat[i + 2]!;
    const y1 = flat[i + 3]!;
    len += Math.abs(x1 - x0) + Math.abs(y1 - y0);
  }
  return len;
}

function countObstacleCrossings(flat: number[], obstacles: { L: number; R: number; T: number; B: number }[]): number {
  let c = 0;
  for (let i = 0; i + 3 < flat.length; i += 2) {
    c += segmentCrossesObstacles(flat[i]!, flat[i + 1]!, flat[i + 2]!, flat[i + 3]!, obstacles);
  }
  return c;
}

function dedupeStraightPoints(flat: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const x = flat[i]!;
    const y = flat[i + 1]!;
    if (out.length >= 4) {
      const px = out[out.length - 2]!;
      const py = out[out.length - 1]!;
      const ppx = out[out.length - 4]!;
      const ppy = out[out.length - 3]!;
      const colinear =
        (Math.abs(ppx - px) < 1e-9 && Math.abs(px - x) < 1e-9) || (Math.abs(ppy - py) < 1e-9 && Math.abs(py - y) < 1e-9);
      if (colinear) {
        out[out.length - 2] = x;
        out[out.length - 1] = y;
        continue;
      }
    }
    out.push(x, y);
  }
  return out;
}

function bestOrthogonalPolyline(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  obstacles: { L: number; R: number; T: number; B: number }[],
  useGrid: boolean,
): number[] {
  const s0 = snapPoint(sx, sy, useGrid);
  const e0 = snapPoint(ex, ey, useGrid);
  sx = s0.x;
  sy = s0.y;
  ex = e0.x;
  ey = e0.y;

  const candA = [sx, sy, ex, sy, ex, ey];
  const candB = [sx, sy, sx, ey, ex, ey];

  const score = (flat: number[]) => {
    const cross = countObstacleCrossings(flat, obstacles);
    const len = pathLength(flat);
    return cross * 10_000 + len;
  };

  let best = score(candA) <= score(candB) ? candA : candB;
  let alt = best === candA ? candB : candA;
  if (countObstacleCrossings(alt, obstacles) < countObstacleCrossings(best, obstacles)) best = alt;
  return dedupeStraightPoints(best);
}

function collectObstacles(
  elements: BlueprintElement[],
  excludeIds: Set<string>,
): { L: number; R: number; T: number; B: number }[] {
  const out: { L: number; R: number; T: number; B: number }[] = [];
  for (const el of elements) {
    if (el.type === "connection" || el.type === "door") continue;
    if (excludeIds.has(el.id)) continue;
    const o = elementObstacleAabb(el);
    if (o) out.push(o);
  }
  return out;
}

function pickClosestAnchors(
  fromAabb: { L: number; R: number; T: number; B: number },
  toAabb: { L: number; R: number; T: number; B: number },
): { sa: Anchor; ea: Anchor } {
  const A = anchorsForElement(fromAabb);
  const B = anchorsForElement(toAabb);
  let best = Infinity;
  let pair: { sa: Anchor; ea: Anchor } = { sa: A[0]!, ea: B[0]! };
  for (const sa of A) {
    for (const ea of B) {
      const d = Math.hypot(sa.x - ea.x, sa.y - ea.y);
      if (d < best) {
        best = d;
        pair = { sa, ea };
      }
    }
  }
  return pair;
}

export function buildOrthogonalConnectionPath(args: {
  elements: BlueprintElement[];
  fromId: string;
  toId: string;
  snapToGrid: boolean;
  /** When false, route with empty obstacles (simple elbow only). */
  avoidObstacles?: boolean;
}): number[] | null {
  const { elements, fromId, toId, snapToGrid, avoidObstacles = true } = args;
  const fromEl = elements.find((e) => e.id === fromId);
  const toEl = elements.find((e) => e.id === toId);
  if (!fromEl || !toEl || !isBlueprintConnectEndpoint(fromEl) || !isBlueprintConnectEndpoint(toEl)) return null;

  const rawFrom = elementWorldAabb(fromEl);
  const rawTo = elementWorldAabb(toEl);
  if (!rawFrom || !rawTo) return null;

  const inflate = (a: typeof rawFrom) => ({
    L: a.L - CONNECT_MARGIN,
    R: a.R + CONNECT_MARGIN,
    T: a.T - CONNECT_MARGIN,
    B: a.B + CONNECT_MARGIN,
  });

  const fromBox = inflate(rawFrom);
  const toBox = inflate(rawTo);

  const { sa, ea } = pickClosestAnchors(fromBox, toBox);
  const exclude = new Set([fromId, toId]);
  const obstacles = avoidObstacles ? collectObstacles(elements, exclude) : [];
  return bestOrthogonalPolyline(sa.x, sa.y, ea.x, ea.y, obstacles, snapToGrid);
}

export function blueprintConnectEndpointIdsInOrder(
  selectedIds: string[],
  elements: BlueprintElement[],
  preferNearestNeighbor: boolean,
): string[] {
  const eligible = selectedIds.filter((id) => {
    const el = elements.find((e) => e.id === id);
    return (
      el &&
      isBlueprintConnectEndpoint(el) &&
      !isBlueprintElementEffectivelyLocked(elements, el)
    );
  });
  if (eligible.length < 2) return eligible;

  if (!preferNearestNeighbor) return eligible;

  const remaining = new Set(eligible);
  const first = eligible[0]!;
  remaining.delete(first);
  const out = [first];
  while (remaining.size > 0) {
    const last = out[out.length - 1]!;
    const la = elementWorldAabb(elements.find((e) => e.id === last)!);
    if (!la) break;
    const lc = { x: (la.L + la.R) / 2, y: (la.T + la.B) / 2 };
    let bestId: string | null = null;
    let bestD = Infinity;
    for (const id of remaining) {
      const a = elementWorldAabb(elements.find((e) => e.id === id)!);
      if (!a) continue;
      const c = { x: (a.L + a.R) / 2, y: (a.T + a.B) / 2 };
      const d = Math.hypot(c.x - lc.x, c.y - lc.y);
      if (d < bestD) {
        bestD = d;
        bestId = id;
      }
    }
    if (!bestId) break;
    out.push(bestId);
    remaining.delete(bestId);
  }
  return out;
}

export function makeConnectionElement(args: {
  id: string;
  fromId: string;
  toId: string;
  flatPoints: number[];
  style: ConnectionStyle;
  layer_id?: string;
}): BlueprintElement {
  const { id, fromId, toId, flatPoints, style, layer_id } = args;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < flatPoints.length; i += 2) {
    const x = flatPoints[i]!;
    const y = flatPoints[i + 1]!;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return {
    id,
    type: "connection",
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    rotation: 0,
    path_points: flatPoints,
    connection_from: fromId,
    connection_to: toId,
    connection_style: style,
    ...(layer_id ? { layer_id } : {}),
  };
}

/** Default sizes for empty aabb fallback in designer local helpers. */
