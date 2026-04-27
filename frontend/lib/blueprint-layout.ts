/**
 * Shared blueprint geometry: API mapping, door wall attachments, axis-aligned bounds.
 * Kept in sync with `BlueprintDesigner` floorplan semantics.
 */

import { isRoom, type BlueprintElement, type BlueprintLayer } from "@/components/zones-devices/blueprint-types";

export type ApiBlueprintElement = {
  id: string;
  type: "zone" | "device" | "door" | "path" | "symbol" | "group" | "connection" | "rectangle" | "ellipse" | "polygon";
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  name?: string | null;
  rotation?: number;
  locked?: boolean | null;
  linked_device_id?: string | null;
  assigned_zone_id?: string | null;
  device_kind?: string | null;
  wall_attachment?: string | null;
  path_points?: number[] | null;
  symbol_type?: string | null;
  symbol_tags?: string[] | null;
  symbol_notes?: string | null;
  children?: string[] | null;
  connection_from?: string | null;
  connection_to?: string | null;
  connection_style?: string | null;
  corner_radius?: number | null;
  layer_id?: string | null;
};

export const DOOR_ALONG_DEFAULT = 32;
export const DOOR_DEPTH_DEFAULT = 10;
const MIN_DOOR_ALONG = 14;
const MAX_DOOR_ALONG = 8000;
const WALL_SNAP_PX = 26;

export const DEVICE_DEFAULT = 44;
export const SYMBOL_DEFAULT = 40;
export const ZONE_RADIUS = 5;
export const GRID = 32;
export const PATH_LINE_TENSION = 0;
export const SYMBOL_LABEL_BAND_GAP = 6;
export const SYMBOL_ICON_Y_NUDGE = 3;

export type WallEdgeIdx = 0 | 1 | 2 | 3;

export type WallAttach =
  | { kind: "rect"; zoneId: string; edge: WallEdgeIdx; t: number }
  | { kind: "poly"; zoneId: string; edgeIdx: number; t: number };

type ZoneAabb = { L: number; R: number; T: number; B: number };

export function zonePolygonFlat(el: BlueprintElement): number[] | null {
  if (!isRoom(el) || !el.path_points || el.path_points.length < 6) return null;
  return el.path_points;
}

export function zoneAabb(el: BlueprintElement): ZoneAabb {
  const poly = zonePolygonFlat(el);
  if (poly) {
    let L = Infinity;
    let R = -Infinity;
    let T = Infinity;
    let B = -Infinity;
    for (let i = 0; i + 1 < poly.length; i += 2) {
      const x = poly[i]!;
      const y = poly[i + 1]!;
      L = Math.min(L, x);
      R = Math.max(R, x);
      T = Math.min(T, y);
      B = Math.max(B, y);
    }
    return { L, R, T, B };
  }
  const w = el.width ?? 120;
  const h = el.height ?? 80;
  const rad = ((el.rotation ?? 0) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const wx = corners.map(([lx, ly]) => el.x + lx * c - ly * s);
  const wy = corners.map(([lx, ly]) => el.y + lx * s + ly * c);
  return {
    L: Math.min(...wx),
    R: Math.max(...wx),
    T: Math.min(...wy),
    B: Math.max(...wy),
  };
}

function inwardNormalLocal(edge: WallEdgeIdx): { lx: number; ly: number } {
  switch (edge) {
    case 0:
      return { lx: 0, ly: 1 };
    case 1:
      return { lx: -1, ly: 0 };
    case 2:
      return { lx: 0, ly: -1 };
    case 3:
      return { lx: 1, ly: 0 };
    default:
      return { lx: 0, ly: 1 };
  }
}

function localEdgeToWorld(z: BlueprintElement, lx: number, ly: number) {
  const rad = ((z.rotation ?? 0) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: lx * c - ly * s, y: lx * s + ly * c };
}

function worldEdgeSegment(z: BlueprintElement, edge: WallEdgeIdx) {
  const w = z.width ?? 120;
  const h = z.height ?? 80;
  const seg =
    edge === 0
      ? { lx1: 0, ly1: 0, lx2: w, ly2: 0 }
      : edge === 1
        ? { lx1: w, ly1: 0, lx2: w, ly2: h }
        : edge === 2
          ? { lx1: w, ly1: h, lx2: 0, ly2: h }
          : { lx1: 0, ly1: h, lx2: 0, ly2: 0 };
  const p1 = localEdgeToWorld(z, seg.lx1, seg.ly1);
  const p2 = localEdgeToWorld(z, seg.lx2, seg.ly2);
  return {
    x1: z.x + p1.x,
    y1: z.y + p1.y,
    x2: z.x + p2.x,
    y2: z.y + p2.y,
  };
}

function inwardNormalWorld(z: BlueprintElement, edge: WallEdgeIdx) {
  const n = inwardNormalLocal(edge);
  return localEdgeToWorld(z, n.lx, n.ly);
}

function polygonCentroidFlat(flat: number[]) {
  let sx = 0;
  let sy = 0;
  const n = flat.length / 2;
  for (let i = 0; i < flat.length; i += 2) {
    sx += flat[i]!;
    sy += flat[i + 1]!;
  }
  return { cx: sx / n, cy: sy / n };
}

function polygonEdgeXY(flat: number[], edgeIdx: number): { x1: number; y1: number; x2: number; y2: number } {
  const n = flat.length / 2;
  const i1 = ((edgeIdx % n) + n) % n;
  const i2 = (i1 + 1) % n;
  return {
    x1: flat[i1 * 2]!,
    y1: flat[i1 * 2 + 1]!,
    x2: flat[i2 * 2]!,
    y2: flat[i2 * 2 + 1]!,
  };
}

function inwardNormalPolygonEdge(flat: number[], edgeIdx: number) {
  const { x1, y1, x2, y2 } = polygonEdgeXY(flat, edgeIdx);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const { cx, cy } = polygonCentroidFlat(flat);
  let nx = -(y2 - y1);
  let ny = x2 - x1;
  const len = Math.hypot(nx, ny) || 1;
  nx /= len;
  ny /= len;
  const dot = (cx - mx) * nx + (cy - my) * ny;
  if (dot < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { nx, ny };
}

function doorLayoutOnWall(zone: BlueprintElement, edge: WallEdgeIdx, t: number, along: number, depth: number) {
  const { x1, y1, x2, y2 } = worldEdgeSegment(zone, edge);
  const wx = x1 + t * (x2 - x1);
  const wy = y1 + t * (y2 - y1);
  const inN = inwardNormalWorld(zone, edge);
  const il = Math.hypot(inN.x, inN.y) || 1;
  const inx = inN.x / il;
  const iny = inN.y / il;
  const cx = wx + inx * (depth / 2);
  const cy = wy + iny * (depth / 2);
  const rot = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return { cx, cy, rot, along, depth };
}

function doorLayoutOnPolygonWall(zone: BlueprintElement, edgeIdx: number, t: number, along: number, depth: number) {
  const flat = zonePolygonFlat(zone);
  if (!flat) return doorLayoutOnWall(zone, 0, t, along, depth);
  const { x1, y1, x2, y2 } = polygonEdgeXY(flat, edgeIdx);
  const wx = x1 + t * (x2 - x1);
  const wy = y1 + t * (y2 - y1);
  const { nx, ny } = inwardNormalPolygonEdge(flat, edgeIdx);
  const cx = wx + nx * (depth / 2);
  const cy = wy + ny * (depth / 2);
  const rot = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return { cx, cy, rot, along, depth };
}

function doorLayoutFromAttach(zone: BlueprintElement, att: WallAttach, along: number, depth: number) {
  if (att.kind === "rect") return doorLayoutOnWall(zone, att.edge, att.t, along, depth);
  return doorLayoutOnPolygonWall(zone, att.edgeIdx, att.t, along, depth);
}

function doorAlongUpperBound(zone: BlueprintElement, att: WallAttach): number {
  if (att.kind === "rect") {
    const { x1, y1, x2, y2 } = worldEdgeSegment(zone, att.edge);
    const len = Math.hypot(x2 - x1, y2 - y1);
    return Math.max(MIN_DOOR_ALONG, 2 * Math.min(att.t, 1 - att.t) * len - 0.5);
  }
  const flat = zonePolygonFlat(zone);
  if (!flat) return MAX_DOOR_ALONG;
  const { x1, y1, x2, y2 } = polygonEdgeXY(flat, att.edgeIdx);
  const len = Math.hypot(x2 - x1, y2 - y1);
  return Math.max(MIN_DOOR_ALONG, 2 * Math.min(att.t, 1 - att.t) * len - 0.5);
}

export function parseWallAttach(s: string | undefined): WallAttach | null {
  if (!s) return null;
  const parts = s.split(":");
  if (parts.length === 4 && parts[1] === "poly") {
    const zoneId = parts[0]!;
    const edgeIdx = Number(parts[2]);
    const t = Number(parts[3]);
    if (!/^[0-9a-f-]{36}$/i.test(zoneId) || !Number.isFinite(edgeIdx) || edgeIdx < 0 || !Number.isFinite(t)) return null;
    return { kind: "poly", zoneId, edgeIdx: Math.floor(edgeIdx), t: Math.max(0, Math.min(1, t)) };
  }
  if (parts.length !== 3) return null;
  const [zoneId, eStr, tStr] = parts;
  const edge = Number(eStr) as WallEdgeIdx;
  const t = Number(tStr);
  if (!/^[0-9a-f-]{36}$/i.test(zoneId) || ![0, 1, 2, 3].includes(edge) || !Number.isFinite(t)) return null;
  return { kind: "rect", zoneId, edge, t: Math.max(0, Math.min(1, t)) };
}

export function serializeWallAttach(a: WallAttach): string {
  if (a.kind === "rect") return `${a.zoneId}:${a.edge}:${a.t.toFixed(4)}`;
  return `${a.zoneId}:poly:${a.edgeIdx}:${a.t.toFixed(4)}`;
}

function doorElementFromAttachment(door: BlueprintElement, elements: BlueprintElement[]): BlueprintElement | null {
  const p = parseWallAttach(door.wall_attachment);
  if (!p) return null;
  const zone = elements.find((z) => z.id === p.zoneId && isRoom(z));
  if (!zone) return null;
  let along = door.width ?? DOOR_ALONG_DEFAULT;
  const maxAlong = doorAlongUpperBound(zone, p);
  along = Math.min(Math.max(along, MIN_DOOR_ALONG), Math.min(MAX_DOOR_ALONG, maxAlong));
  const depth = door.height ?? DOOR_DEPTH_DEFAULT;
  const { cx, cy, rot } = doorLayoutFromAttach(zone, p, along, depth);
  return { ...door, x: cx, y: cy, rotation: rot, width: along, height: depth };
}

export function relayoutAttachedDoors(elements: BlueprintElement[], zoneId: string): BlueprintElement[] {
  return elements.map((e) => {
    if (e.type !== "door") return e;
    const p = parseWallAttach(e.wall_attachment);
    if (!p || p.zoneId !== zoneId) return e;
    return doorElementFromAttachment(e, elements) ?? e;
  });
}

export function relayoutAllDoors(elements: BlueprintElement[]): BlueprintElement[] {
  return elements.map((e) => (e.type === "door" ? doorElementFromAttachment(e, elements) ?? e : e));
}

export function bboxFromPathPoints(flat: number[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const x = flat[i];
    const y = flat[i + 1];
    minX = Math.min(minX, x!);
    minY = Math.min(minY, y!);
    maxX = Math.max(maxX, x!);
    maxY = Math.max(maxY, y!);
  }
  return { minX, minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

export function elementWorldAabb(el: BlueprintElement): { L: number; R: number; T: number; B: number } | null {
  if (el.type === "connection" && el.path_points && el.path_points.length >= 4) {
    const pts = el.path_points;
    let L = Infinity;
    let R = -Infinity;
    let T = Infinity;
    let B = -Infinity;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      L = Math.min(L, pts[i]!);
      R = Math.max(R, pts[i]!);
      T = Math.min(T, pts[i + 1]!);
      B = Math.max(B, pts[i + 1]!);
    }
    if (!Number.isFinite(L)) return null;
    return { L, R, T, B };
  }
  if (el.type === "path" && el.path_points && el.path_points.length >= 6) {
    const pts = el.path_points;
    let L = Infinity;
    let R = -Infinity;
    let T = Infinity;
    let B = -Infinity;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      L = Math.min(L, pts[i]!);
      R = Math.max(R, pts[i]!);
      T = Math.min(T, pts[i + 1]!);
      B = Math.max(B, pts[i + 1]!);
    }
    if (!Number.isFinite(L)) return null;
    return { L, R, T, B };
  }
  if (el.type === "polygon" && el.path_points && el.path_points.length >= 6) {
    const pts = el.path_points;
    let L = Infinity;
    let R = -Infinity;
    let T = Infinity;
    let B = -Infinity;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      L = Math.min(L, pts[i]!);
      R = Math.max(R, pts[i]!);
      T = Math.min(T, pts[i + 1]!);
      B = Math.max(B, pts[i + 1]!);
    }
    if (!Number.isFinite(L)) return null;
    return { L, R, T, B };
  }
  if (el.type === "door") {
    const along = el.width ?? DOOR_ALONG_DEFAULT;
    const depth = el.height ?? DOOR_DEPTH_DEFAULT;
    const rad = ((el.rotation ?? 0) * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const corners: [number, number][] = [
      [-along / 2, -depth / 2],
      [along / 2, -depth / 2],
      [along / 2, depth / 2],
      [-along / 2, depth / 2],
    ];
    const wx = corners.map(([lx, ly]) => el.x + lx * c - ly * s);
    const wy = corners.map(([lx, ly]) => el.y + lx * s + ly * c);
    return { L: Math.min(...wx), R: Math.max(...wx), T: Math.min(...wy), B: Math.max(...wy) };
  }
  if (isRoom(el)) return zoneAabb(el);
  if (el.type === "group") {
    const w = el.width ?? 1;
    const h = el.height ?? 1;
    return { L: el.x, R: el.x + w, T: el.y, B: el.y + h };
  }
  const w = el.width ?? DEVICE_DEFAULT;
  const h = el.height ?? DEVICE_DEFAULT;
  const rad = ((el.rotation ?? 0) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const wx = corners.map(([lx, ly]) => el.x + lx * c - ly * s);
  const wy = corners.map(([lx, ly]) => el.y + lx * s + ly * c);
  return { L: Math.min(...wx), R: Math.max(...wx), T: Math.min(...wy), B: Math.max(...wy) };
}

/** Matches designer / read-only canvas draw order (groups have no painted node). */
/** Normalize `blueprint.layers` from API JSON for the editor and read-only preview. */
export function parseApiBlueprintLayers(raw: unknown): BlueprintLayer[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: BlueprintLayer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = String((item as { id?: unknown }).id ?? "").trim();
    const name = String((item as { name?: unknown }).name ?? "Layer").trim() || "Layer";
    if (!id) continue;
    out.push({ id, name: name.slice(0, 120) });
  }
  return out;
}

const PAINT_TYPE_ORDER: BlueprintElement["type"][] = [
  "zone",
  "rectangle",
  "ellipse",
  "polygon",
  "door",
  "symbol",
  "device",
  "path",
  "connection",
];

const PAINT_ORDER_GAP = 250_000;

/**
 * Konva `zIndex` per element id. `layers` is top-first (index 0 = top). When `layers` is empty, returns an empty map
 * (caller keeps legacy sibling order). Unknown or missing `layer_id` is treated as the bottom layer (last in `layers`).
 */
export function blueprintPaintZIndices(elements: BlueprintElement[], layers: BlueprintLayer[]): Map<string, number> {
  const map = new Map<string, number>();
  if (!layers.length) return map;
  const rank = new Map(layers.map((L, i) => [L.id, i]));
  const bottomId = layers[layers.length - 1]!.id;
  const resolveLayer = (el: BlueprintElement) =>
    el.layer_id && rank.has(el.layer_id) ? el.layer_id : bottomId;
  const orderedIds: string[] = [];
  for (const t of PAINT_TYPE_ORDER) {
    for (const el of elements) {
      if (el.type === t) orderedIds.push(el.id);
    }
  }
  let seq = 0;
  for (const id of orderedIds) {
    const el = elements.find((e) => e.id === id);
    if (!el) continue;
    const lid = resolveLayer(el);
    const li = rank.get(lid) ?? layers.length - 1;
    const tier = (layers.length - li) * PAINT_ORDER_GAP;
    map.set(id, tier + seq++);
  }
  return map;
}

export function unionBlueprintElementsBounds(elements: BlueprintElement[]): {
  L: number;
  R: number;
  T: number;
  B: number;
} | null {
  let L = Infinity;
  let R = -Infinity;
  let T = Infinity;
  let B = -Infinity;
  let any = false;
  for (const el of elements) {
    if (el.type === "group") continue;
    const a = elementWorldAabb(el);
    if (!a) continue;
    any = true;
    L = Math.min(L, a.L);
    R = Math.max(R, a.R);
    T = Math.min(T, a.T);
    B = Math.max(B, a.B);
  }
  return any ? { L, R, T, B } : null;
}

export function mapApiElement(e: ApiBlueprintElement): BlueprintElement {
  return {
    id: e.id,
    type: e.type,
    x: e.x,
    y: e.y,
    width: e.width ?? undefined,
    height: e.height ?? undefined,
    name: e.name ?? undefined,
    rotation: e.rotation ?? 0,
    locked: e.locked === true ? true : undefined,
    linked_device_id: e.linked_device_id ?? undefined,
    assigned_zone_id: e.assigned_zone_id ?? undefined,
    device_kind: e.device_kind ?? undefined,
    wall_attachment: e.wall_attachment ?? undefined,
    path_points: e.path_points ?? undefined,
    symbol_type: e.symbol_type ?? undefined,
    symbol_tags: e.symbol_tags ?? undefined,
    symbol_notes: e.symbol_notes ?? undefined,
    children: e.type === "group" && Array.isArray(e.children) ? e.children.map(String) : undefined,
    connection_from: e.connection_from ?? undefined,
    connection_to: e.connection_to ?? undefined,
    connection_style:
      e.type === "connection" && (e.connection_style === "electrical" || e.connection_style === "plumbing")
        ? e.connection_style
        : undefined,
    cornerRadius:
      e.type === "rectangle" && e.corner_radius != null && Number.isFinite(Number(e.corner_radius))
        ? Number(e.corner_radius)
        : undefined,
    layer_id: e.layer_id ?? undefined,
  };
}

export function toApiPayload(elements: BlueprintElement[]) {
  return elements.map((el) => ({
    id: el.id,
    type: el.type,
    x: el.x,
    y: el.y,
    width: el.width ?? null,
    height: el.height ?? null,
    rotation: el.rotation ?? 0,
    locked: el.locked === true,
    name: el.name ?? null,
    linked_device_id: el.linked_device_id ?? null,
    assigned_zone_id: el.assigned_zone_id ?? null,
    device_kind: el.device_kind ?? null,
    wall_attachment: el.wall_attachment ?? null,
    path_points: el.path_points ?? null,
    symbol_type: el.symbol_type ?? null,
    symbol_tags: el.symbol_tags ?? null,
    symbol_notes: el.symbol_notes ?? null,
    children: el.type === "group" && el.children?.length ? el.children : null,
    connection_from: el.type === "connection" ? el.connection_from ?? null : null,
    connection_to: el.type === "connection" ? el.connection_to ?? null : null,
    connection_style: el.type === "connection" ? el.connection_style ?? null : null,
    corner_radius: el.type === "rectangle" ? (el.cornerRadius ?? null) : null,
    layer_id: el.layer_id ?? null,
  }));
}

function closestOnSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 1e-12 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  const d = Math.hypot(px - qx, py - qy);
  return { t, d };
}

/** Wall under pointer when placing doors (editor). */
export function nearestWallHit(px: number, py: number, elements: BlueprintElement[]): WallAttach | null {
  let best: { att: WallAttach; d: number } | null = null;
  for (const z of elements) {
    if (!isRoom(z)) continue;
    const poly = zonePolygonFlat(z);
    if (poly) {
      const n = poly.length / 2;
      for (let e = 0; e < n; e++) {
        const { x1, y1, x2, y2 } = polygonEdgeXY(poly, e);
        const { t, d } = closestOnSegment(px, py, x1, y1, x2, y2);
        const att: WallAttach = { kind: "poly", zoneId: z.id, edgeIdx: e, t };
        if (d <= WALL_SNAP_PX && (!best || d < best.d)) best = { att, d };
      }
      continue;
    }
    for (let e = 0; e < 4; e++) {
      const edge = e as WallEdgeIdx;
      const { x1, y1, x2, y2 } = worldEdgeSegment(z, edge);
      const { t, d } = closestOnSegment(px, py, x1, y1, x2, y2);
      const att: WallAttach = { kind: "rect", zoneId: z.id, edge, t };
      if (d <= WALL_SNAP_PX && (!best || d < best.d)) best = { att, d };
    }
  }
  return best?.att ?? null;
}
