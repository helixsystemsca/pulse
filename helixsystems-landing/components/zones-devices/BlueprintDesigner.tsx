"use client";

import { animate, AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { apiFetch } from "@/lib/api";
import { bpDuration, bpEase, bpTransition } from "@/lib/motion-presets";
import "./blueprint-designer.css";

/** Frontend blueprint element (API uses the same shape; optional fields match OpenAPI). */
export type BlueprintElement = {
  id: string;
  type: "zone" | "device" | "door" | "path" | "symbol";
  x: number;
  y: number;
  width?: number;
  height?: number;
  name?: string;
  rotation?: number;
  linked_device_id?: string;
  assigned_zone_id?: string;
  device_kind?: string;
  /** Door on zone wall: "{zoneElementId}:{edge0-3}:{t01}" */
  wall_attachment?: string;
  /** Flat x,y pairs (world), closed polygon without repeating first vertex */
  path_points?: number[];
  /** Symbol discriminator (extensible; built-ins listed in SYMBOL_LIBRARY) */
  symbol_type?: string;
  symbol_tags?: string[];
  symbol_notes?: string;
};

type Tool =
  | "select"
  | "draw-room"
  | "place-device"
  | "place-door"
  | "free-draw"
  | "place-symbol";
type DeviceKind = "pump" | "tank" | "sensor" | "generic";

/** Built-in symbols — extend this list + `SymbolGlyph` to add types. */
export const SYMBOL_LIBRARY = ["tree", "bush", "sprinkler", "valve", "pump", "motor", "filter"] as const;
export type SymbolLibraryId = (typeof SYMBOL_LIBRARY)[number];

type BlueprintSummary = { id: string; name: string; created_at: string };
type ApiElement = {
  id: string;
  type: "zone" | "device" | "door" | "path" | "symbol";
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  name?: string | null;
  rotation?: number;
  linked_device_id?: string | null;
  assigned_zone_id?: string | null;
  device_kind?: string | null;
  wall_attachment?: string | null;
  path_points?: number[] | null;
  symbol_type?: string | null;
  symbol_tags?: string[] | null;
  symbol_notes?: string | null;
};

type BlueprintDetail = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  elements: ApiElement[];
};

const GRID = 32;
const DEVICE_DEFAULT = 44;
const SYMBOL_DEFAULT = 40;
const MIN_ZONE = 24;
/** Zone edge snap distance (world px) */
const SNAP_PX = 8;
const DOOR_ALONG_DEFAULT = 32;
const DOOR_DEPTH_DEFAULT = 10;
/** Max distance from click to zone edge to place a door (world px) */
const WALL_SNAP_PX = 26;
/** Match blueprint canvas background (--bp-bg) for wall “cut” overlay */
const CANVAS_BG_CUT = "#0f172a";

/** Free-draw: min distance between raw samples (world px) */
const FREE_DRAW_SAMPLE_DIST = 1.1;
/** RDP simplify epsilon (world px) */
const PATH_RDP_EPS = 3.5;
/** Snap last point to first when closing stroke (world px) */
const PATH_CLOSE_SNAP = 18;
/** Chaikin corner-cutting iterations */
const PATH_CHAIKIN_ITER = 2;
/** Konva Line tension for organic edges */
const PATH_LINE_TENSION = 0.42;

type WallEdgeIdx = 0 | 1 | 2 | 3;

type ZoneAabb = { L: number; R: number; T: number; B: number };

/** World-space axis-aligned bounds for a zone (Konva Rect: position top-left, rotation about top-left). */
function zoneAabb(el: BlueprintElement): ZoneAabb {
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

type SnapGuide = { kind: "v"; x: number } | { kind: "h"; y: number };

function snapZoneDrag(
  dragged: BlueprintElement,
  nx: number,
  ny: number,
  all: BlueprintElement[],
): { x: number; y: number; guides: SnapGuide[] } {
  const w = dragged.width ?? 120;
  const h = dragged.height ?? 80;
  const rot = dragged.rotation ?? 0;
  const self = (x: number, y: number) => zoneAabb({ ...dragged, x, y, width: w, height: h, rotation: rot });

  let D = self(nx, ny);
  let bestDx = 0;
  let bestAbsX = SNAP_PX + 1;
  let gx: number | null = null;
  const tryX = (dEdge: number, oEdge: number) => {
    const diff = oEdge - dEdge;
    if (Math.abs(diff) <= SNAP_PX && Math.abs(diff) < bestAbsX) {
      bestAbsX = Math.abs(diff);
      bestDx = diff;
      gx = oEdge;
    }
  };
  for (const o of all) {
    if (o.id === dragged.id || o.type !== "zone") continue;
    const O = zoneAabb(o);
    tryX(D.L, O.L);
    tryX(D.L, O.R);
    tryX(D.R, O.L);
    tryX(D.R, O.R);
  }
  const nx2 = nx + bestDx;
  D = self(nx2, ny);

  let bestDy = 0;
  let bestAbsY = SNAP_PX + 1;
  let gy: number | null = null;
  const tryY = (dEdge: number, oEdge: number) => {
    const diff = oEdge - dEdge;
    if (Math.abs(diff) <= SNAP_PX && Math.abs(diff) < bestAbsY) {
      bestAbsY = Math.abs(diff);
      bestDy = diff;
      gy = oEdge;
    }
  };
  for (const o of all) {
    if (o.id === dragged.id || o.type !== "zone") continue;
    const O = zoneAabb(o);
    tryY(D.T, O.T);
    tryY(D.T, O.B);
    tryY(D.B, O.T);
    tryY(D.B, O.B);
  }
  const ny2 = ny + bestDy;
  const guides: SnapGuide[] = [];
  if (gx !== null && bestAbsX <= SNAP_PX) guides.push({ kind: "v", x: gx });
  if (gy !== null && bestAbsY <= SNAP_PX) guides.push({ kind: "h", y: gy });
  return { x: nx2, y: ny2, guides };
}

/** Snap axis-aligned box edges (rotation ~0) for transformer / resize */
function snapAxisAlignedBox(
  box: { x: number; y: number; width: number; height: number; rotation?: number },
  all: BlueprintElement[],
  excludeId: string,
): { x: number; y: number; width: number; height: number } {
  if (Math.abs(box.rotation ?? 0) > 1e-5) return { x: box.x, y: box.y, width: box.width, height: box.height };

  let { x, y, width, height } = box;
  const xTargets: number[] = [];
  const yTargets: number[] = [];
  for (const o of all) {
    if (o.id === excludeId || o.type !== "zone") continue;
    const O = zoneAabb(o);
    xTargets.push(O.L, O.R);
    yTargets.push(O.T, O.B);
  }

  const snapScalar = (edge: number, targets: number[]) => {
    let best = 0;
    let bestAbs = SNAP_PX + 1;
    for (const t of targets) {
      const d = t - edge;
      if (Math.abs(d) <= SNAP_PX && Math.abs(d) < bestAbs) {
        bestAbs = Math.abs(d);
        best = d;
      }
    }
    return bestAbs <= SNAP_PX ? best : 0;
  };

  // Left then right (adjusts width)
  x += snapScalar(x, xTargets);
  const rEdge = x + width;
  const dR = snapScalar(rEdge, xTargets);
  width = Math.max(MIN_ZONE, width + dR);

  y += snapScalar(y, yTargets);
  const bEdge = y + height;
  const dB = snapScalar(bEdge, yTargets);
  height = Math.max(MIN_ZONE, height + dB);

  return { x, y, width, height };
}

/** Guide lines when a snapped axis-aligned box shares an edge with another zone (post-snap / live transform). */
function snapGuidesBetweenZones(
  box: { x: number; y: number; width: number; height: number },
  all: BlueprintElement[],
  excludeId: string,
): SnapGuide[] {
  const eps = 1;
  const L = box.x;
  const R = box.x + box.width;
  const T = box.y;
  const B = box.y + box.height;
  const vx: number[] = [];
  const hy: number[] = [];
  for (const o of all) {
    if (o.id === excludeId || o.type !== "zone") continue;
    const O = zoneAabb(o);
    for (const xg of [O.L, O.R]) {
      if (Math.abs(L - xg) <= eps || Math.abs(R - xg) <= eps) vx.push(xg);
    }
    for (const yg of [O.T, O.B]) {
      if (Math.abs(T - yg) <= eps || Math.abs(B - yg) <= eps) hy.push(yg);
    }
  }
  const guides: SnapGuide[] = [];
  for (const x of [...new Set(vx)]) guides.push({ kind: "v", x });
  for (const y of [...new Set(hy)]) guides.push({ kind: "h", y });
  return guides;
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

function closestOnSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 1e-12 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  const d = Math.hypot(px - qx, py - qy);
  return { t, d, qx, qy };
}

function nearestWallHit(
  px: number,
  py: number,
  elements: BlueprintElement[],
): { zoneId: string; edge: WallEdgeIdx; t: number } | null {
  let best: { zoneId: string; edge: WallEdgeIdx; t: number; d: number } | null = null;
  for (const z of elements) {
    if (z.type !== "zone") continue;
    for (let e = 0; e < 4; e++) {
      const edge = e as WallEdgeIdx;
      const { x1, y1, x2, y2 } = worldEdgeSegment(z, edge);
      const { t, d } = closestOnSegment(px, py, x1, y1, x2, y2);
      if (d <= WALL_SNAP_PX && (!best || d < best.d)) best = { zoneId: z.id, edge, t, d };
    }
  }
  if (!best) return null;
  return { zoneId: best.zoneId, edge: best.edge, t: best.t };
}

function formatWallAttachment(zoneId: string, edge: WallEdgeIdx, t: number) {
  return `${zoneId}:${edge}:${t.toFixed(4)}`;
}

function parseWallAttachment(s: string | undefined): { zoneId: string; edge: WallEdgeIdx; t: number } | null {
  if (!s) return null;
  const parts = s.split(":");
  if (parts.length !== 3) return null;
  const [zoneId, eStr, tStr] = parts;
  const edge = Number(eStr) as WallEdgeIdx;
  const t = Number(tStr);
  if (!/^[0-9a-f-]{36}$/i.test(zoneId) || ![0, 1, 2, 3].includes(edge) || !Number.isFinite(t)) return null;
  return { zoneId, edge, t: Math.max(0, Math.min(1, t)) };
}

function doorLayoutOnWall(
  zone: BlueprintElement,
  edge: WallEdgeIdx,
  t: number,
  along: number,
  depth: number,
) {
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

function doorElementFromAttachment(door: BlueprintElement, elements: BlueprintElement[]): BlueprintElement | null {
  const p = parseWallAttachment(door.wall_attachment);
  if (!p) return null;
  const zone = elements.find((z) => z.id === p.zoneId && z.type === "zone");
  if (!zone) return null;
  const along = door.width ?? DOOR_ALONG_DEFAULT;
  const depth = door.height ?? DOOR_DEPTH_DEFAULT;
  const { cx, cy, rot } = doorLayoutOnWall(zone, p.edge, p.t, along, depth);
  return { ...door, x: cx, y: cy, rotation: rot, width: along, height: depth };
}

function relayoutAttachedDoors(elements: BlueprintElement[], zoneId: string): BlueprintElement[] {
  return elements.map((e) => {
    if (e.type !== "door") return e;
    const p = parseWallAttachment(e.wall_attachment);
    if (!p || p.zoneId !== zoneId) return e;
    return doorElementFromAttachment(e, elements) ?? e;
  });
}

function relayoutAllDoors(elements: BlueprintElement[]): BlueprintElement[] {
  return elements.map((e) => (e.type === "door" ? doorElementFromAttachment(e, elements) ?? e : e));
}

function flatToPoints(flat: number[]): [number, number][] {
  const o: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) o.push([flat[i], flat[i + 1]]);
  return o;
}

function pointsToFlat(pts: [number, number][]): number[] {
  const o: number[] = [];
  for (const [x, y] of pts) {
    o.push(x, y);
  }
  return o;
}

function perpendicularDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return Math.hypot(px - ax, py - ay);
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
}

function rdpOpen(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length < 3) return pts.slice();
  let idx = 0;
  let dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDistance(pts[i], pts[0], pts[pts.length - 1]);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax > eps) {
    const a = rdpOpen(pts.slice(0, idx + 1), eps);
    const b = rdpOpen(pts.slice(idx), eps);
    return [...a.slice(0, -1), ...b];
  }
  return [pts[0], pts[pts.length - 1]];
}

function rdpClosedFlat(flat: number[], eps: number): number[] {
  const pts = flatToPoints(flat);
  if (pts.length < 3) return flat.slice();
  const open: [number, number][] = [...pts, pts[0]];
  const simp = rdpOpen(open, eps);
  if (simp.length < 2) return flat.slice();
  const last = simp[simp.length - 1];
  if (Math.hypot(last[0] - simp[0][0], last[1] - simp[0][1]) < 1e-6) {
    return pointsToFlat(simp.slice(0, -1));
  }
  return pointsToFlat(simp.slice(0, -1));
}

function chaikinClosedFlat(flat: number[], iterations: number): number[] {
  let pts = flatToPoints(flat);
  if (pts.length < 3) return flat.slice();
  for (let iter = 0; iter < iterations; iter++) {
    const next: [number, number][] = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % n];
      next.push([p0[0] + 0.25 * (p1[0] - p0[0]), p0[1] + 0.25 * (p1[1] - p0[1])]);
      next.push([p0[0] + 0.75 * (p1[0] - p0[0]), p0[1] + 0.75 * (p1[1] - p0[1])]);
    }
    pts = next;
  }
  return pointsToFlat(pts);
}

function closeRingFlat(flat: number[], snapDist: number): number[] {
  if (flat.length < 4) return flat.slice();
  const x0 = flat[0];
  const y0 = flat[1];
  const x1 = flat[flat.length - 2];
  const y1 = flat[flat.length - 1];
  if (Math.hypot(x1 - x0, y1 - y0) <= snapDist) {
    return flat.slice(0, -2);
  }
  return [...flat, x0, y0];
}

function bboxFromPathPoints(flat: number[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const x = flat[i];
    const y = flat[i + 1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function processFreehandPath(raw: number[]): number[] | null {
  if (raw.length < 6) return null;
  let ring = closeRingFlat(raw, PATH_CLOSE_SNAP);
  if (ring.length < 6) return null;
  let simplified = rdpClosedFlat(ring, PATH_RDP_EPS);
  if (simplified.length < 6) simplified = ring;
  if (simplified.length < 6) return null;
  const smoothed = chaikinClosedFlat(simplified, PATH_CHAIKIN_ITER);
  return smoothed.length >= 6 ? smoothed : null;
}

function mockLinkStatus(linkedId: string | undefined): "neutral" | "normal" | "warning" | "alarm" {
  if (!linkedId) return "neutral";
  const n = linkedId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const m = n % 4;
  if (m === 0) return "normal";
  if (m === 1) return "warning";
  return "alarm";
}

/** Subtle status accents (wireframe + soft fill) — not neon */
const STATUS_STROKE: Record<string, string> = {
  neutral: "rgba(203, 213, 245, 0.62)",
  normal: "rgba(34, 197, 94, 0.7)",
  warning: "rgba(250, 204, 21, 0.72)",
  alarm: "rgba(239, 68, 68, 0.68)",
};

const STATUS_SOFT_FILL: Record<string, string> = {
  neutral: "rgba(203, 213, 245, 0.05)",
  normal: "rgba(34, 197, 94, 0.07)",
  warning: "rgba(250, 204, 21, 0.08)",
  alarm: "rgba(239, 68, 68, 0.07)",
};

const ZONE_FACE_FILL = "rgba(248, 250, 252, 0.038)";
const ZONE_OUTLINE = "rgba(229, 231, 235, 0.9)";
const ZONE_OUTLINE_HOVER = "rgba(248, 250, 252, 0.98)";
const ZONE_RADIUS = 5;

function wallDropOffset(deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = 2.6 * Math.cos(rad) - 3.8 * Math.sin(rad);
  const dy = 2.6 * Math.sin(rad) + 3.8 * Math.cos(rad);
  return { dx, dy };
}

function getWorldFromStage(stage: Konva.Stage | null): { x: number; y: number } | null {
  if (!stage) return null;
  const p = stage.getPointerPosition();
  if (!p) return null;
  return {
    x: (p.x - stage.x()) / stage.scaleX(),
    y: (p.y - stage.y()) / stage.scaleY(),
  };
}

function mapApiElement(e: ApiElement): BlueprintElement {
  return {
    id: e.id,
    type: e.type,
    x: e.x,
    y: e.y,
    width: e.width ?? undefined,
    height: e.height ?? undefined,
    name: e.name ?? undefined,
    rotation: e.rotation ?? 0,
    linked_device_id: e.linked_device_id ?? undefined,
    assigned_zone_id: e.assigned_zone_id ?? undefined,
    device_kind: e.device_kind ?? undefined,
    wall_attachment: e.wall_attachment ?? undefined,
    path_points: e.path_points ?? undefined,
    symbol_type: e.symbol_type ?? undefined,
    symbol_tags: e.symbol_tags ?? undefined,
    symbol_notes: e.symbol_notes ?? undefined,
  };
}

function toApiPayload(elements: BlueprintElement[]) {
  return elements.map((el) => ({
    id: el.id,
    type: el.type,
    x: el.x,
    y: el.y,
    width: el.width ?? null,
    height: el.height ?? null,
    rotation: el.rotation ?? 0,
    name: el.name ?? null,
    linked_device_id: el.linked_device_id ?? null,
    assigned_zone_id: el.assigned_zone_id ?? null,
    device_kind: el.device_kind ?? null,
    wall_attachment: el.wall_attachment ?? null,
    path_points: el.path_points ?? null,
    symbol_type: el.symbol_type ?? null,
    symbol_tags: el.symbol_tags ?? null,
    symbol_notes: el.symbol_notes ?? null,
  }));
}

function nextRoomLabel(elements: BlueprintElement[]): string {
  const zones = elements.filter((z) => z.type === "zone");
  const n = zones.length + 1;
  return `Room ${n}`;
}

/** Minimal monochrome blueprint-style glyphs (stroke-forward). */
function DeviceGlyph({ kind, statusKey }: { kind: string; statusKey: string }) {
  const stroke = STATUS_STROKE[statusKey] ?? STATUS_STROKE.neutral;
  const soft = STATUS_SOFT_FILL[statusKey] ?? STATUS_SOFT_FILL.neutral;
  const swm = 1.35;
  const r = 14;

  switch (kind) {
    case "pump":
      return (
        <Group listening={false}>
          <Circle radius={r} fill={soft} stroke={stroke} strokeWidth={swm} />
          <Rect
            x={-2.5}
            y={-r - 7}
            width={5}
            height={7}
            cornerRadius={1}
            fill="transparent"
            stroke={stroke}
            strokeWidth={swm * 0.9}
          />
          <Line points={[-5, r * 0.35, 5, r * 0.35]} stroke={stroke} strokeWidth={swm * 0.85} listening={false} />
        </Group>
      );
    case "tank":
      return (
        <Rect
          x={-r}
          y={-r + 1}
          width={r * 2}
          height={r * 2 - 2}
          cornerRadius={5}
          fill={soft}
          stroke={stroke}
          strokeWidth={swm}
          listening={false}
        />
      );
    case "sensor":
      return (
        <Line
          points={[0, -r, r * 0.92, r * 0.55, -r * 0.92, r * 0.55]}
          closed
          fill={soft}
          stroke={stroke}
          strokeWidth={swm}
          lineJoin="round"
          listening={false}
        />
      );
    default:
      return <Circle radius={r} fill={soft} stroke={stroke} strokeWidth={swm} listening={false} />;
  }
}

const SYMBOL_STROKE = "rgba(226, 232, 240, 0.88)";
const SYMBOL_FILL = "rgba(56, 189, 248, 0.14)";
const SYMBOL_FILL2 = "rgba(34, 197, 94, 0.12)";
const SYMBOL_SW = 1.25;

/** Minimal blueprint-style icons for map symbols (`symbol_type` is extensible). */
function SymbolGlyph({ symbolType }: { symbolType: string }) {
  const k = symbolType.toLowerCase();
  const sw = SYMBOL_SW;
  switch (k) {
    case "tree":
      return (
        <Group listening={false}>
          <Rect x={-2} y={4} width={4} height={10} fill="rgba(120, 83, 58, 0.65)" cornerRadius={1} listening={false} />
          <Circle x={0} y={-2} radius={11} fill={SYMBOL_FILL2} stroke={SYMBOL_STROKE} strokeWidth={sw} listening={false} />
          <Circle x={-5} y={2} radius={6} fill={SYMBOL_FILL2} stroke={SYMBOL_STROKE} strokeWidth={sw * 0.85} listening={false} />
          <Circle x={6} y={1} radius={5} fill={SYMBOL_FILL2} stroke={SYMBOL_STROKE} strokeWidth={sw * 0.85} listening={false} />
        </Group>
      );
    case "bush":
      return (
        <Group listening={false}>
          <Circle x={-6} y={0} radius={7} fill={SYMBOL_FILL2} stroke={SYMBOL_STROKE} strokeWidth={sw} listening={false} />
          <Circle x={6} y={1} radius={8} fill={SYMBOL_FILL2} stroke={SYMBOL_STROKE} strokeWidth={sw} listening={false} />
          <Circle x={0} y={-5} radius={7} fill={SYMBOL_FILL2} stroke={SYMBOL_STROKE} strokeWidth={sw} listening={false} />
        </Group>
      );
    case "sprinkler":
      return (
        <Group listening={false}>
          <Circle radius={9} fill={SYMBOL_FILL} stroke={SYMBOL_STROKE} strokeWidth={sw} listening={false} />
          <Line points={[0, -9, 0, -16]} stroke={SYMBOL_STROKE} strokeWidth={sw} listening={false} />
          <Line points={[-10, -12, 10, -12]} stroke={SYMBOL_STROKE} strokeWidth={sw * 0.9} listening={false} />
          <Line points={[-7, -14, 7, -14]} stroke={SYMBOL_STROKE} strokeWidth={sw * 0.75} listening={false} />
        </Group>
      );
    case "valve":
      return (
        <Group listening={false}>
          <Rect x={-10} y={-3} width={20} height={6} fill={SYMBOL_FILL} stroke={SYMBOL_STROKE} strokeWidth={sw} cornerRadius={2} listening={false} />
          <Rect x={-3} y={-12} width={6} height={22} fill={SYMBOL_FILL} stroke={SYMBOL_STROKE} strokeWidth={sw} cornerRadius={2} listening={false} />
        </Group>
      );
    case "pump":
      return (
        <Group listening={false}>
          <Circle radius={10} fill={SYMBOL_FILL} stroke={SYMBOL_STROKE} strokeWidth={sw} listening={false} />
          <Rect x={-2.5} y={-16} width={5} height={7} fill="transparent" stroke={SYMBOL_STROKE} strokeWidth={sw} cornerRadius={1} listening={false} />
          <Line points={[-6, 5, 6, 5]} stroke={SYMBOL_STROKE} strokeWidth={sw * 0.85} listening={false} />
        </Group>
      );
    case "motor":
      return (
        <Group listening={false}>
          <Circle radius={11} fill={SYMBOL_FILL} stroke={SYMBOL_STROKE} strokeWidth={sw} listening={false} />
          <Line points={[-5, -4, 5, 4]} stroke={SYMBOL_STROKE} strokeWidth={sw * 1.1} lineCap="round" listening={false} />
          <Line points={[5, -4, -5, 4]} stroke={SYMBOL_STROKE} strokeWidth={sw * 1.1} lineCap="round" listening={false} />
        </Group>
      );
    case "filter":
      return (
        <Group listening={false}>
          <Rect x={-8} y={-12} width={16} height={24} fill={SYMBOL_FILL} stroke={SYMBOL_STROKE} strokeWidth={sw} cornerRadius={3} listening={false} />
          <Line points={[-5, -6, 5, -6]} stroke={SYMBOL_STROKE} strokeWidth={sw * 0.8} listening={false} />
          <Line points={[-5, 0, 5, 0]} stroke={SYMBOL_STROKE} strokeWidth={sw * 0.8} listening={false} />
          <Line points={[-5, 6, 5, 6]} stroke={SYMBOL_STROKE} strokeWidth={sw * 0.8} listening={false} />
        </Group>
      );
    default:
      return (
        <Group listening={false}>
          <Circle radius={10} fill={SYMBOL_FILL} stroke={SYMBOL_STROKE} strokeWidth={sw} listening={false} />
          <Line points={[-5, -2, 5, -2]} stroke={SYMBOL_STROKE} strokeWidth={sw} listening={false} />
        </Group>
      );
  }
}

function parseTagsFromInput(s: string): string[] {
  return s
    .split(/[,\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Soft status glow behind device — Framer Motion loop; triggers one layer batch per frame (few devices). */
function DevicePulseHalo({
  cx,
  cy,
  mode,
  onFrame,
}: {
  cx: number;
  cy: number;
  mode: "alarm" | "warning";
  onFrame: () => void;
}) {
  const circleRef = useRef<Konva.Circle | null>(null);
  useEffect(() => {
    const c = circleRef.current;
    if (!c) return;
    const low = mode === "alarm" ? 0.07 : 0.04;
    const high = mode === "alarm" ? 0.26 : 0.19;
    const dur = mode === "alarm" ? 1.4 : 2.12;
    const ctrl = animate(low, high, {
      duration: dur,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
      onUpdate: (v) => {
        c.opacity(v);
        onFrame();
      },
    });
    return () => ctrl.stop();
  }, [mode, onFrame]);
  return (
    <Circle
      ref={circleRef}
      x={cx}
      y={cy}
      radius={mode === "alarm" ? 30 : 28}
      fill={mode === "alarm" ? "rgba(239, 68, 68, 0.18)" : "rgba(250, 204, 21, 0.14)"}
      listening={false}
    />
  );
}

export function BlueprintDesigner() {
  const [elements, setElements] = useState<BlueprintElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [placeKind, setPlaceKind] = useState<DeviceKind>("generic");
  const [placeSymbolKind, setPlaceSymbolKind] = useState<SymbolLibraryId>("tree");
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [blueprintName, setBlueprintName] = useState("Untitled blueprint");
  const [list, setList] = useState<BlueprintSummary[]>([]);
  const [stageSize, setStageSize] = useState({ w: 800, h: 520 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [drawDraft, setDrawDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [designerMode, setDesignerMode] = useState<"edit" | "publish">("edit");

  const [zonesApi, setZonesApi] = useState<{ id: string; name: string }[]>([]);
  const [equipmentApi, setEquipmentApi] = useState<{ id: string; name: string }[]>([]);

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const selectedNodeRef = useRef<Konva.Node | null>(null);
  const drawOriginRef = useRef<{ x: number; y: number } | null>(null);
  const drawDraftRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const dragAnimRef = useRef<ReturnType<typeof animate> | null>(null);
  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);
  const [hoverDeviceId, setHoverDeviceId] = useState<string | null>(null);
  const [hoverSymbolId, setHoverSymbolId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [freeDrawPreview, setFreeDrawPreview] = useState<number[] | null>(null);
  const freeDrawAccumRef = useRef<number[]>([]);
  const freeDrawWinCleanupRef = useRef<(() => void) | null>(null);

  const batchLayer = useCallback(() => {
    layerRef.current?.batchDraw();
  }, []);

  const blueprintExportSlug = useCallback(() => {
    const s = (blueprintName || "blueprint").trim();
    const t = s.replace(/[^a-z0-9\-_]+/gi, "_").replace(/_+/g, "_");
    return (t || "blueprint").slice(0, 96);
  }, [blueprintName]);

  const downloadBlueprintPng = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      const dataUrl = stage.toDataURL({ pixelRatio: 3, mimeType: "image/png" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${blueprintExportSlug()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PNG export failed");
    }
  }, [blueprintExportSlug]);

  const downloadBlueprintPdf = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
      const W = stage.width();
      const H = stage.height();
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        orientation: W >= H ? "landscape" : "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      doc.setFontSize(11);
      doc.setTextColor(40, 50, 70);
      doc.text(blueprintName || "Blueprint", margin, margin - 4);
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2 - 28;
      const sc = Math.min(availW / W, availH / H);
      const dw = W * sc;
      const dh = H * sc;
      doc.addImage(dataUrl, "PNG", (pageW - dw) / 2, margin + 14, dw, dh);
      doc.save(`${blueprintExportSlug()}.pdf`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed");
    }
  }, [blueprintName, blueprintExportSlug]);

  useEffect(() => {
    setHoverZoneId(null);
    setHoverDeviceId(null);
    setHoverSymbolId(null);
    setSnapGuides([]);
    freeDrawWinCleanupRef.current?.();
    freeDrawWinCleanupRef.current = null;
    freeDrawAccumRef.current = [];
    setFreeDrawPreview(null);
  }, [tool]);

  const runDragScale = useCallback((node: Konva.Node, to: number) => {
    dragAnimRef.current?.stop();
    const from = node.scaleX();
    if (Math.abs(from - to) < 0.002) return;
    dragAnimRef.current = animate(from, to, {
      duration: bpDuration.med,
      ease: bpEase,
      onUpdate: (v) => {
        node.scaleX(v);
        node.scaleY(v);
        layerRef.current?.batchDraw();
      },
    });
  }, []);

  const selected = elements.find((e) => e.id === selectedId) ?? null;

  const isPublish = designerMode === "publish";
  const canEdit = !isPublish;
  const pubLine = (v: number) => v * (isPublish ? 1.42 : 1);
  const pubFs = (v: number) => v * (isPublish ? 1.2 : 1);
  const symScale = isPublish ? 1.12 : 1;
  const symbolLegendTypes = [
    ...new Set(
      elements
        .filter((e) => e.type === "symbol")
        .map((e) => e.symbol_type)
        .filter((t): t is string => Boolean(t)),
    ),
  ].sort();

  useEffect(() => {
    drawDraftRef.current = drawDraft;
  }, [drawDraft]);

  const refreshList = useCallback(async () => {
    try {
      const rows = await apiFetch<BlueprintSummary[]>("/api/blueprints");
      setList(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list blueprints");
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    const loadRefs = async () => {
      try {
        const [zones, equip] = await Promise.all([
          apiFetch<{ id: string; name: string }[]>("/api/v1/zones").catch(() => []),
          apiFetch<{ id: string; name: string }[]>("/api/v1/equipment").catch(() => []),
        ]);
        setZonesApi(zones);
        setEquipmentApi(equip);
      } catch {
        /* optional dropdowns */
      }
    };
    void loadRefs();
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const w = Math.max(320, Math.floor(r.width));
      const h = Math.max(380, Math.floor(r.height));
      setStageSize({ w, h });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setStageSize({ w: Math.max(320, Math.floor(r.width)), h: Math.max(380, Math.floor(r.height)) });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  useEffect(() => {
    if (!isPanning) return;
    const move = (e: MouseEvent) => {
      const last = panLastRef.current;
      if (!last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      panLastRef.current = { x: e.clientX, y: e.clientY };
      setStagePos((p) => ({ x: p.x + dx, y: p.y + dy }));
    };
    const up = () => {
      setIsPanning(false);
      panLastRef.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [isPanning]);

  const loadBlueprint = async (id: string) => {
    try {
      const d = await apiFetch<BlueprintDetail>(`/api/blueprints/${id}`);
      setBlueprintId(d.id);
      setBlueprintName(d.name);
      setElements(relayoutAllDoors(d.elements.map(mapApiElement)));
      setSelectedId(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load blueprint");
    }
  };

  const saveBlueprint = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = { name: blueprintName.trim() || "Untitled blueprint", elements: toApiPayload(elements) };
      if (blueprintId) {
        const d = await apiFetch<BlueprintDetail>(`/api/blueprints/${blueprintId}`, {
          method: "PUT",
          json: payload,
        });
        setElements(relayoutAllDoors(d.elements.map(mapApiElement)));
      } else {
        const d = await apiFetch<BlueprintDetail>("/api/blueprints", { method: "POST", json: payload });
        setBlueprintId(d.id);
        setElements(relayoutAllDoors(d.elements.map(mapApiElement)));
      }
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const newBlueprint = () => {
    setBlueprintId(null);
    setBlueprintName("Untitled blueprint");
    setElements([]);
    setSelectedId(null);
    setTool("select");
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const scaleBy = 1.08;
    const oldScale = stageScale;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clamped = Math.max(0.12, Math.min(4.5, newScale));
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    const nextPos = {
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    };
    setStageScale(clamped);
    setStagePos(nextPos);
  };

  const startDraw = (x: number, y: number) => {
    drawOriginRef.current = { x, y };
    setDrawDraft({ x, y, w: 0, h: 0 });
  };

  const updateDraw = (x: number, y: number) => {
    const o = drawOriginRef.current;
    if (!o) return;
    const w = x - o.x;
    const h = y - o.y;
    setDrawDraft({ x: w < 0 ? x : o.x, y: h < 0 ? y : o.y, w: Math.abs(w), h: Math.abs(h) });
  };

  const finishDraw = () => {
    const o = drawOriginRef.current;
    const d = drawDraftRef.current;
    drawOriginRef.current = null;
    setDrawDraft(null);
    drawDraftRef.current = null;
    if (!o || !d || d.w < MIN_ZONE || d.h < MIN_ZONE) return;
    const id = crypto.randomUUID();
    setElements((prev) => [
      ...prev,
      {
        id,
        type: "zone",
        x: d.x,
        y: d.y,
        width: d.w,
        height: d.h,
        name: nextRoomLabel(prev),
        rotation: 0,
      },
    ]);
    setSelectedId(id);
    setTool("select");
  };

  const placeDeviceAt = (x: number, y: number) => {
    const id = crypto.randomUUID();
    const w = DEVICE_DEFAULT;
    const h = DEVICE_DEFAULT;
    setElements((prev) => [
      ...prev,
      {
        id,
        type: "device",
        x: x - w / 2,
        y: y - h / 2,
        width: w,
        height: h,
        name: placeKind.charAt(0).toUpperCase() + placeKind.slice(1),
        rotation: 0,
        device_kind: placeKind,
      },
    ]);
    setSelectedId(id);
    setTool("select");
  };

  const placeSymbolAt = (cx: number, cy: number) => {
    const id = crypto.randomUUID();
    const w = SYMBOL_DEFAULT;
    const h = SYMBOL_DEFAULT;
    const st = placeSymbolKind;
    const label = st.charAt(0).toUpperCase() + st.slice(1);
    setElements((prev) => [
      ...prev,
      {
        id,
        type: "symbol" as const,
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h,
        rotation: 0,
        name: label,
        symbol_type: st,
        symbol_tags: [],
      },
    ]);
    setSelectedId(id);
    setTool("select");
  };

  const placeDoorAt = (px: number, py: number) => {
    let createdId: string | null = null;
    setElements((prev) => {
      const hit = nearestWallHit(px, py, prev);
      if (!hit) return prev;
      const zone = prev.find((z) => z.id === hit.zoneId && z.type === "zone");
      if (!zone) return prev;
      const id = crypto.randomUUID();
      const along = DOOR_ALONG_DEFAULT;
      const depth = DOOR_DEPTH_DEFAULT;
      const wall_attachment = formatWallAttachment(hit.zoneId, hit.edge, hit.t);
      const { cx, cy, rot } = doorLayoutOnWall(zone, hit.edge, hit.t, along, depth);
      createdId = id;
      return [
        ...prev,
        {
          id,
          type: "door" as const,
          x: cx,
          y: cy,
          width: along,
          height: depth,
          rotation: rot,
          name: "Door",
          wall_attachment,
        },
      ];
    });
    if (createdId) {
      setSelectedId(createdId);
      setTool("select");
    }
  };

  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanning) return;
    const stage = e.target.getStage();
    if (!stage) return;
    if (e.evt.button === 2) {
      e.evt.preventDefault();
      setIsPanning(true);
      panLastRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }
    if (spaceDown && e.evt.button === 0) {
      e.evt.preventDefault();
      setIsPanning(true);
      panLastRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }
  };

  const onStageMouseMove = () => {
    if (tool !== "draw-room" || !drawOriginRef.current) return;
    const w = getWorldFromStage(stageRef.current);
    if (w) updateDraw(w.x, w.y);
  };

  const onStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === "draw-room" && e.evt.button === 0 && drawOriginRef.current) {
      finishDraw();
    }
  };

  const onPlaceOverlayClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    const w = getWorldFromStage(e.target.getStage());
    if (w) placeDeviceAt(w.x, w.y);
  };

  const onDoorOverlayClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    const w = getWorldFromStage(e.target.getStage());
    if (w) placeDoorAt(w.x, w.y);
  };

  const onSymbolOverlayClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    const w = getWorldFromStage(e.target.getStage());
    if (w) placeSymbolAt(w.x, w.y);
  };

  const onFreeDrawPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (tool !== "free-draw") return;
    e.cancelBubble = true;
    if (e.evt.pointerType === "mouse" && e.evt.button !== 0) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const w0 = getWorldFromStage(stage);
    if (!w0) return;
    freeDrawWinCleanupRef.current?.();
    freeDrawWinCleanupRef.current = null;
    freeDrawAccumRef.current = [w0.x, w0.y];
    setFreeDrawPreview([w0.x, w0.y]);

    const appendPoint = (wx: number, wy: number) => {
      const buf = freeDrawAccumRef.current;
      if (buf.length >= 2) {
        const lx = buf[buf.length - 2];
        const ly = buf[buf.length - 1];
        if (Math.hypot(wx - lx, wy - ly) < FREE_DRAW_SAMPLE_DIST) return;
      }
      freeDrawAccumRef.current = [...buf, wx, wy];
      setFreeDrawPreview([...freeDrawAccumRef.current]);
    };

    const onMove = (ev: PointerEvent) => {
      const st = stageRef.current;
      if (!st) return;
      const rect = st.container().getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      const wx = (sx - st.x()) / st.scaleX();
      const wy = (sy - st.y()) / st.scaleY();
      appendPoint(wx, wy);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      freeDrawWinCleanupRef.current = null;
      const raw = freeDrawAccumRef.current;
      freeDrawAccumRef.current = [];
      setFreeDrawPreview(null);
      const processed = processFreehandPath(raw);
      if (processed) {
        const id = crypto.randomUUID();
        const { minX, minY, w, h } = bboxFromPathPoints(processed);
        setElements((prev) => [
          ...prev,
          {
            id,
            type: "path" as const,
            x: minX,
            y: minY,
            width: w,
            height: h,
            rotation: 0,
            name: "Shape",
            path_points: processed,
          },
        ]);
        setSelectedId(id);
        setTool("select");
      }
    };

    freeDrawWinCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const onHitEmptyClick = () => {
    if (tool === "select") {
      setSelectedId(null);
      setSnapGuides([]);
    }
  };

  const syncTransformToState = (id: string, node: Konva.Node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const rotation = node.rotation();
    const x = node.x();
    const y = node.y();
    let width: number;
    let height: number;
    if (node.getClassName() === "Rect") {
      const r = node as Konva.Rect;
      width = Math.max(MIN_ZONE, r.width() * scaleX);
      height = Math.max(MIN_ZONE, r.height() * scaleY);
    } else {
      const g = node as Konva.Group;
      width = Math.max(20, g.width() * scaleX);
      height = Math.max(20, g.height() * scaleY);
    }
    setElements((prev) => {
      let next = prev.map((el) =>
        el.id === id
          ? {
              ...el,
              x,
              y,
              width,
              height,
              rotation,
            }
          : el,
      );
      const updated = next.find((e) => e.id === id);
      if (updated?.type === "zone") next = relayoutAttachedDoors(next, id);
      return next;
    });
  };

  useLayoutEffect(() => {
    if (!selectedId) selectedNodeRef.current = null;
  }, [selectedId]);

  useLayoutEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (designerMode === "publish") {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const n = selectedNodeRef.current;
    if (n && selectedId && tool === "select") {
      tr.nodes([n]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements, tool, stageSize.w, stageSize.h, designerMode]);

  const gridLines = (() => {
    const { w, h } = stageSize;
    const minWX = (-stagePos.x) / stageScale;
    const maxWX = (w - stagePos.x) / stageScale;
    const minWY = (-stagePos.y) / stageScale;
    const maxWY = (h - stagePos.y) / stageScale;
    const pad = GRID * 3;
    const lines: React.ReactNode[] = [];
    const stroke = isPublish ? "rgba(148, 163, 184, 0.095)" : "rgba(148, 163, 184, 0.042)";
    const sw = pubLine(1 / stageScale);
    let k = 0;
    for (let x = Math.floor((minWX - pad) / GRID) * GRID; x <= maxWX + pad; x += GRID) {
      lines.push(
        <Line
          key={`v${k++}`}
          points={[x, minWY - pad, x, maxWY + pad]}
          stroke={stroke}
          strokeWidth={sw}
          listening={false}
        />,
      );
    }
    for (let y = Math.floor((minWY - pad) / GRID) * GRID; y <= maxWY + pad; y += GRID) {
      lines.push(
        <Line
          key={`h${k++}`}
          points={[minWX - pad, y, maxWX + pad, y]}
          stroke={stroke}
          strokeWidth={sw}
          listening={false}
        />,
      );
    }
    return lines;
  })();

  const snapGuideLines = (() => {
    if (!canEdit || snapGuides.length === 0) return null;
    const { w, h } = stageSize;
    const minWX = (-stagePos.x) / stageScale;
    const maxWX = (w - stagePos.x) / stageScale;
    const minWY = (-stagePos.y) / stageScale;
    const maxWY = (h - stagePos.y) / stageScale;
    const pad = GRID * 24;
    const sw = pubLine(Math.max(0.75, 1 / stageScale));
    const stroke = "rgba(96, 165, 250, 0.55)";
    return snapGuides.map((g, i) =>
      g.kind === "v" ? (
        <Line
          key={`snapg-v-${i}-${g.x}`}
          points={[g.x, minWY - pad, g.x, maxWY + pad]}
          stroke={stroke}
          strokeWidth={sw}
          dash={[5, 5]}
          listening={false}
        />
      ) : (
        <Line
          key={`snapg-h-${i}-${g.y}`}
          points={[minWX - pad, g.y, maxWX + pad, g.y]}
          stroke={stroke}
          strokeWidth={sw}
          dash={[5, 5]}
          listening={false}
        />
      ),
    );
  })();

  const updateSelectedField = (patch: Partial<BlueprintElement>) => {
    if (!selectedId) return;
    setElements((prev) => prev.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)));
  };

  return (
    <div className={`bp-shell${isPublish ? " bp-shell--publish" : ""}`}>
      <motion.aside
        className={`bp-sidebar${isPublish ? " bp-sidebar--disabled" : ""}`}
        aria-label="Tools"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={bpTransition.med}
      >
        <div>
          <h3>Tools</h3>
          <div className="bp-tool-grid">
            <motion.button
              type="button"
              className={`bp-tool ${tool === "select" ? "is-active" : ""}`}
              onClick={() => setTool("select")}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 22px rgba(0, 0, 0, 0.16)" }}
              whileTap={{ scale: 0.985 }}
              transition={bpTransition.fast}
            >
              Select
            </motion.button>
            <motion.button
              type="button"
              className={`bp-tool ${tool === "draw-room" ? "is-active" : ""}`}
              onClick={() => setTool("draw-room")}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 22px rgba(0, 0, 0, 0.16)" }}
              whileTap={{ scale: 0.985 }}
              transition={bpTransition.fast}
            >
              Draw room
            </motion.button>
            <motion.button
              type="button"
              className={`bp-tool ${tool === "place-device" ? "is-active" : ""}`}
              onClick={() => setTool("place-device")}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 22px rgba(0, 0, 0, 0.16)" }}
              whileTap={{ scale: 0.985 }}
              transition={bpTransition.fast}
            >
              Place device
            </motion.button>
            <motion.button
              type="button"
              className={`bp-tool ${tool === "place-door" ? "is-active" : ""}`}
              onClick={() => setTool("place-door")}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 22px rgba(0, 0, 0, 0.16)" }}
              whileTap={{ scale: 0.985 }}
              transition={bpTransition.fast}
            >
              Door
            </motion.button>
            <motion.button
              type="button"
              className={`bp-tool ${tool === "free-draw" ? "is-active" : ""}`}
              onClick={() => setTool("free-draw")}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 22px rgba(0, 0, 0, 0.16)" }}
              whileTap={{ scale: 0.985 }}
              transition={bpTransition.fast}
            >
              Free draw
            </motion.button>
            <motion.button
              type="button"
              className={`bp-tool ${tool === "place-symbol" ? "is-active" : ""}`}
              onClick={() => setTool("place-symbol")}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 22px rgba(0, 0, 0, 0.16)" }}
              whileTap={{ scale: 0.985 }}
              transition={bpTransition.fast}
            >
              Place symbol
            </motion.button>
          </div>
        </div>
        <div>
          <h3>Symbol library</h3>
          <div className="bp-palette">
            {SYMBOL_LIBRARY.map((k) => (
              <motion.button
                key={k}
                type="button"
                className={`bp-chip ${placeSymbolKind === k ? "is-active" : ""}`}
                onClick={() => {
                  setPlaceSymbolKind(k);
                  setTool("place-symbol");
                }}
                whileHover={{ scale: 1.02, y: -1, boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)" }}
                whileTap={{ scale: 0.98 }}
                transition={bpTransition.fast}
              >
                {k}
              </motion.button>
            ))}
          </div>
        </div>
        <div>
          <h3>Device palette</h3>
          <div className="bp-palette">
            {(["pump", "tank", "sensor", "generic"] as DeviceKind[]).map((k) => (
              <motion.button
                key={k}
                type="button"
                className={`bp-chip ${placeKind === k ? "is-active" : ""}`}
                onClick={() => setPlaceKind(k)}
                whileHover={{ scale: 1.02, y: -1, boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)" }}
                whileTap={{ scale: 0.98 }}
                transition={bpTransition.fast}
              >
                {k}
              </motion.button>
            ))}
          </div>
        </div>
        <p className="bp-hint">
          Scroll to zoom (cursor-centered). Hold Space and drag or right-drag to pan. Draw rooms on the grid. Door:{" "}
          click within {WALL_SNAP_PX}px of a room edge. Free draw: drag and release; stroke is simplified and smoothed
          into a closed shape. Place symbol: pick a kind, then click the canvas (extensible via symbol_type).
        </p>
      </motion.aside>

      <motion.div
        className={`bp-canvas-wrap${isPublish ? " bp-canvas-wrap--publish" : ""}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...bpTransition.med, delay: 0.02 }}
      >
        <AnimatePresence>
          {isPublish ? (
            <motion.div
              key="publish-bar"
              className="bp-publish-bar"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={bpTransition.fast}
            >
              <div className="bp-publish-bar__lead">
                <span className="bp-publish-bar__label">Published preview</span>
                <span className="bp-publish-bar__title">{blueprintName || "Blueprint"}</span>
              </div>
              <div className="bp-publish-bar__actions">
                <button type="button" className="bp-btn bp-btn--ghost" onClick={() => setDesignerMode("edit")}>
                  Back to editing
                </button>
                <button type="button" className="bp-btn" onClick={() => void downloadBlueprintPng()}>
                  Download PNG
                </button>
                <button type="button" className="bp-btn" onClick={() => void downloadBlueprintPdf()}>
                  Download PDF
                </button>
              </div>
              {symbolLegendTypes.length > 0 ? (
                <div className="bp-publish-legend" role="list" aria-label="Symbol legend">
                  <span className="bp-publish-legend__title">Legend</span>
                  {symbolLegendTypes.map((t) => (
                    <span key={t} className="bp-publish-legend__item" role="listitem">
                      <span className="bp-publish-legend__dot" aria-hidden />
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <motion.div
          className="bp-toolbar"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...bpTransition.fast, delay: 0.05 }}
        >
          <span>
            <label htmlFor="bp-pick">Blueprint</label>
            <select
              id="bp-pick"
              value={blueprintId ?? ""}
              disabled={isPublish}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) newBlueprint();
                else void loadBlueprint(v);
              }}
            >
              <option value="">— New —</option>
              {list.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </span>
          <span>
            <label htmlFor="bp-name">Name</label>
            <input
              id="bp-name"
              type="text"
              value={blueprintName}
              disabled={isPublish}
              onChange={(e) => setBlueprintName(e.target.value)}
            />
          </span>
          <motion.button
            type="button"
            className="bp-btn bp-btn--ghost"
            disabled={isPublish}
            onClick={newBlueprint}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.985 }}
            transition={bpTransition.fast}
          >
            New
          </motion.button>
          <motion.button
            type="button"
            className="bp-btn"
            disabled={saving || isPublish}
            onClick={() => void saveBlueprint()}
            whileHover={saving ? undefined : { scale: 1.02, boxShadow: "0 8px 24px rgba(59, 130, 246, 0.2)" }}
            whileTap={saving ? undefined : { scale: 0.985 }}
            transition={bpTransition.fast}
          >
            {saving ? "Saving…" : "Save"}
          </motion.button>
          <motion.button
            type="button"
            className="bp-btn"
            disabled={isPublish}
            onClick={() => {
              setDesignerMode("publish");
              setTool("select");
              setSelectedId(null);
              setSnapGuides([]);
            }}
            whileHover={isPublish ? undefined : { scale: 1.02, boxShadow: "0 8px 24px rgba(16, 185, 129, 0.18)" }}
            whileTap={isPublish ? undefined : { scale: 0.985 }}
            transition={bpTransition.fast}
          >
            Publish
          </motion.button>
        </motion.div>
        <AnimatePresence>
          {error ? (
            <motion.p
              key={error}
              className="bp-error"
              style={{ margin: "0.5rem 0.75rem" }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={bpTransition.med}
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <div
          ref={hostRef}
          className={`bp-stage-host ${spaceDown || isPanning ? "is-panning" : ""}${isPublish ? " bp-stage-host--publish" : ""}`}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Stage
            width={stageSize.w}
            height={stageSize.h}
            ref={stageRef}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}
            onWheel={handleWheel}
            onMouseDown={onStageMouseDown}
            onMouseMove={onStageMouseMove}
            onMouseUp={onStageMouseUp}
          >
            <Layer ref={layerRef}>
              {gridLines}
              {snapGuideLines}
              {canEdit && freeDrawPreview && freeDrawPreview.length >= 4 ? (
                <Line
                  points={freeDrawPreview}
                  stroke="rgba(96, 165, 250, 0.5)"
                  strokeWidth={Math.max(0.85, 1.15 / stageScale)}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                  dash={[6, 4]}
                />
              ) : null}
              <Rect
                x={-8000}
                y={-8000}
                width={20000}
                height={20000}
                fill="rgba(15,23,42,0.01)"
                listening={canEdit && (tool === "select" || tool === "draw-room")}
                onClick={canEdit ? onHitEmptyClick : undefined}
                onMouseDown={(e) => {
                  if (!canEdit) return;
                  if (tool === "draw-room" && e.evt.button === 0) {
                    e.cancelBubble = true;
                    const st = e.target.getStage();
                    const w = getWorldFromStage(st);
                    if (w) startDraw(w.x, w.y);
                  }
                }}
              />
              {elements
                .filter((el) => el.type === "zone")
                .map((el) => {
                  const w = el.width ?? 120;
                  const h = el.height ?? 80;
                  const sel = el.id === selectedId;
                  const rot = el.rotation ?? 0;
                  const { dx, dy } = wallDropOffset(rot);
                  const sw = pubLine(Math.max(0.75, 1.22 / stageScale));
                  const ins = Math.max(0.6, pubLine(1.05 / stageScale));
                  const labelSize = pubFs(Math.min(11, Math.max(9, Math.min(w, h) / 7)));
                  const zGlow = canEdit && tool === "select" && !sel && hoverZoneId === el.id;
                  const zoneFill = isPublish ? "rgba(248, 250, 252, 0.085)" : ZONE_FACE_FILL;
                  const zoneStroke = isPublish ? "rgba(241, 245, 249, 0.94)" : ZONE_OUTLINE;
                  return (
                    <Group key={el.id}>
                      {/* Elevation mass — offset duplicate (under room face) */}
                      <Rect
                        x={el.x + dx}
                        y={el.y + dy}
                        width={w}
                        height={h}
                        rotation={rot}
                        cornerRadius={ZONE_RADIUS}
                        fill="rgba(3, 7, 18, 0.62)"
                        listening={false}
                        opacity={0.85}
                        shadowColor="rgba(0, 0, 0, 0.55)"
                        shadowBlur={10}
                        shadowOpacity={0.22}
                        shadowOffset={{ x: 0, y: 1 }}
                      />
                      {/* Top / left highlight & bottom / right shade (architectural bevel) */}
                      <Group x={el.x} y={el.y} rotation={rot} listening={false}>
                        <Line
                          points={[ins, ins, w - ins, ins]}
                          stroke={isPublish ? "rgba(248, 250, 252, 0.5)" : "rgba(248, 250, 252, 0.34)"}
                          strokeWidth={sw * 0.88}
                          lineCap="round"
                          listening={false}
                        />
                        <Line
                          points={[ins, ins, ins, h - ins]}
                          stroke={isPublish ? "rgba(248, 250, 252, 0.44)" : "rgba(248, 250, 252, 0.28)"}
                          strokeWidth={sw * 0.88}
                          lineCap="round"
                          listening={false}
                        />
                        <Line
                          points={[ins, h - ins, w - ins, h - ins]}
                          stroke={isPublish ? "rgba(2, 6, 18, 0.58)" : "rgba(2, 6, 18, 0.45)"}
                          strokeWidth={sw}
                          lineCap="round"
                          listening={false}
                        />
                        <Line
                          points={[w - ins, ins, w - ins, h - ins]}
                          stroke={isPublish ? "rgba(2, 6, 18, 0.6)" : "rgba(2, 6, 18, 0.48)"}
                          strokeWidth={sw}
                          lineCap="round"
                          listening={false}
                        />
                      </Group>
                      <Rect
                        ref={(node) => {
                          if (sel && tool === "select" && canEdit) selectedNodeRef.current = node;
                        }}
                        x={el.x}
                        y={el.y}
                        width={w}
                        height={h}
                        rotation={rot}
                        cornerRadius={ZONE_RADIUS}
                        fill={zoneFill}
                        stroke={zoneStroke}
                        strokeWidth={sw}
                        shadowColor={
                          sel ? "rgba(59, 130, 246, 0.42)" : zGlow ? "rgba(96, 165, 250, 0.32)" : "rgba(0, 0, 0, 0.2)"
                        }
                        shadowBlur={sel ? 18 : zGlow ? 12 : 6}
                        shadowOpacity={sel ? 0.34 : zGlow ? 0.18 : 0.12}
                        shadowOffset={{ x: 0, y: sel ? 0 : 2 }}
                        listening={canEdit && tool === "select"}
                        draggable={canEdit && tool === "select"}
                        onMouseEnter={(e) => {
                          if (canEdit && tool === "select" && !sel) setHoverZoneId(el.id);
                          const t = e.target as unknown as { getClassName?: () => string; stroke?: (s: string) => void };
                          if (canEdit && tool === "select" && !sel && t.getClassName?.() === "Rect") t.stroke?.(ZONE_OUTLINE_HOVER);
                        }}
                        onMouseLeave={(e) => {
                          setHoverZoneId((z) => (z === el.id ? null : z));
                          const t = e.target as unknown as { getClassName?: () => string; stroke?: (s: string) => void };
                          if (t.getClassName?.() === "Rect") t.stroke?.(zoneStroke);
                        }}
                        onClick={() => canEdit && setSelectedId(el.id)}
                        onTap={() => canEdit && setSelectedId(el.id)}
                        onDragStart={(e) => {
                          if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                        }}
                        onDragMove={(e) => {
                          if (!canEdit || tool !== "select") return;
                          const node = e.target;
                          const { x, y, guides } = snapZoneDrag(el, node.x(), node.y(), elements);
                          node.x(x);
                          node.y(y);
                          setSnapGuides(guides);
                          batchLayer();
                        }}
                        onDragEnd={(e) => {
                          const node = e.target;
                          const nx = node.x();
                          const ny = node.y();
                          runDragScale(node, 1);
                          setSnapGuides([]);
                          setElements((prev) => {
                            const moved = prev.map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x));
                            return relayoutAttachedDoors(moved, el.id);
                          });
                        }}
                        onTransformEnd={(e) => {
                          setSnapGuides([]);
                          syncTransformToState(el.id, e.target);
                        }}
                      />
                      <Text
                        text={(el.name ?? "ROOM").toUpperCase()}
                        x={el.x}
                        y={el.y}
                        width={w}
                        height={h}
                        rotation={rot}
                        align="center"
                        verticalAlign="middle"
                        fill={isPublish ? "#f1f5f9" : "#cbd5f5"}
                        opacity={isPublish ? 0.98 : 0.94}
                        fontSize={labelSize}
                        fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
                        fontStyle="normal"
                        letterSpacing={2}
                        listening={false}
                        wrap="none"
                        ellipsis
                      />
                    </Group>
                  );
                })}
              {elements
                .filter((el) => el.type === "door")
                .map((el) => {
                  const sel = el.id === selectedId;
                  const along = el.width ?? DOOR_ALONG_DEFAULT;
                  const depth = el.height ?? DOOR_DEPTH_DEFAULT;
                  const bleed = Math.max(1.25, 2.2 / stageScale);
                  const sw = pubLine(Math.max(0.55, 0.88 / stageScale));
                  const rot = el.rotation ?? 0;
                  const doorStroke = sel
                    ? "rgba(96, 165, 250, 0.62)"
                    : isPublish
                      ? "rgba(226, 232, 240, 0.9)"
                      : "rgba(148, 163, 184, 0.45)";
                  const doorFill = isPublish ? "rgba(15, 23, 42, 0.32)" : "rgba(15, 23, 42, 0.2)";
                  return (
                    <Group
                      key={el.id}
                      x={el.x}
                      y={el.y}
                      rotation={rot}
                      listening={canEdit && tool === "select"}
                      onClick={() => canEdit && setSelectedId(el.id)}
                      onTap={() => canEdit && setSelectedId(el.id)}
                    >
                      <Rect
                        x={-along / 2 - bleed}
                        y={-depth / 2 - bleed}
                        width={along + 2 * bleed}
                        height={depth + 2 * bleed}
                        cornerRadius={3}
                        fill={CANVAS_BG_CUT}
                        listening={false}
                      />
                      <Rect
                        x={-along / 2}
                        y={-depth / 2}
                        width={along}
                        height={depth}
                        cornerRadius={2}
                        fill={doorFill}
                        stroke={doorStroke}
                        strokeWidth={sw}
                        listening={false}
                      />
                    </Group>
                  );
                })}
              {elements
                .filter((el) => el.type === "symbol")
                .map((el) => {
                  const w = el.width ?? SYMBOL_DEFAULT;
                  const h = el.height ?? SYMBOL_DEFAULT;
                  const st = el.symbol_type ?? "generic";
                  const sel = el.id === selectedId;
                  const sStroke = pubLine(Math.max(0.65, 0.9 / stageScale));
                  const sGlow = canEdit && tool === "select" && !sel && hoverSymbolId === el.id;
                  const symLabelFs = pubFs(Math.min(9, w / 5));
                  return (
                    <Group
                      key={el.id}
                      x={el.x}
                      y={el.y}
                      rotation={el.rotation ?? 0}
                      listening={canEdit && tool === "select"}
                      draggable={canEdit && tool === "select"}
                      shadowColor={
                        isPublish
                          ? "rgba(0, 0, 0, 0.25)"
                          : sel
                            ? "rgba(59, 130, 246, 0.35)"
                            : sGlow
                              ? "rgba(96, 165, 250, 0.28)"
                              : "rgba(0, 0, 0, 0.45)"
                      }
                      shadowBlur={isPublish ? 6 : sel ? 14 : sGlow ? 11 : 8}
                      shadowOpacity={isPublish ? 0.18 : 0.28}
                      shadowOffset={{ x: 0, y: 3 }}
                      onClick={() => canEdit && setSelectedId(el.id)}
                      onTap={() => canEdit && setSelectedId(el.id)}
                      onDragStart={(e) => {
                        if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragEnd={(e) => {
                        const node = e.target;
                        const nx = node.x();
                        const ny = node.y();
                        runDragScale(node, 1);
                        setElements((prev) =>
                          prev.map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x)),
                        );
                      }}
                      onMouseEnter={() => {
                        if (canEdit && tool === "select" && !sel) setHoverSymbolId(el.id);
                      }}
                      onMouseLeave={() => setHoverSymbolId((z) => (z === el.id ? null : z))}
                      opacity={0.98}
                    >
                      <Rect
                        width={w}
                        height={h}
                        cornerRadius={8}
                        fill={isPublish ? "rgba(248, 250, 252, 0.1)" : "rgba(15, 23, 42, 0.14)"}
                        stroke={
                          sel
                            ? "rgba(96, 165, 250, 0.55)"
                            : sGlow
                              ? "rgba(203, 213, 245, 0.32)"
                              : isPublish
                                ? "rgba(226, 232, 240, 0.42)"
                                : "rgba(203, 213, 245, 0.12)"
                        }
                        strokeWidth={sStroke}
                        listening={false}
                      />
                      <Group x={w / 2} y={h / 2} scaleX={symScale} scaleY={symScale} listening={false}>
                        <SymbolGlyph symbolType={st} />
                      </Group>
                      <Text
                        text={(el.name ?? st).toUpperCase()}
                        x={2}
                        y={h - 12}
                        width={w - 4}
                        align="center"
                        fill={isPublish ? "#f1f5f9" : "#cbd5f5"}
                        opacity={isPublish ? 0.95 : 0.82}
                        fontSize={symLabelFs}
                        fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
                        listening={false}
                        ellipsis
                      />
                    </Group>
                  );
                })}
              {elements
                .filter((el) => el.type === "device")
                .map((el) => {
                  const w = el.width ?? DEVICE_DEFAULT;
                  const h = el.height ?? DEVICE_DEFAULT;
                  const kind = el.device_kind ?? "generic";
                  const st = mockLinkStatus(el.linked_device_id);
                  const sel = el.id === selectedId;
                  const dStroke = pubLine(Math.max(0.65, 0.92 / stageScale));
                  const dGlow = canEdit && tool === "select" && !sel && hoverDeviceId === el.id;
                  const pulse = !isPublish && (st === "alarm" || st === "warning");
                  return (
                    <Group
                      key={el.id}
                      ref={(node) => {
                        if (sel && tool === "select" && canEdit) selectedNodeRef.current = node;
                      }}
                      x={el.x}
                      y={el.y}
                      rotation={el.rotation ?? 0}
                      listening={canEdit && tool === "select"}
                      draggable={canEdit && tool === "select"}
                      shadowColor={
                        isPublish
                          ? "rgba(0, 0, 0, 0.35)"
                          : sel
                            ? "rgba(59, 130, 246, 0.42)"
                            : dGlow
                              ? "rgba(96, 165, 250, 0.3)"
                              : "rgba(0, 0, 0, 0.55)"
                      }
                      shadowBlur={isPublish ? 8 : sel ? 19 : dGlow ? 14 : 11}
                      shadowOpacity={isPublish ? 0.16 : 0.24}
                      shadowOffset={{ x: 0, y: 5 }}
                      onClick={() => canEdit && setSelectedId(el.id)}
                      onTap={() => canEdit && setSelectedId(el.id)}
                      onDragStart={(e) => {
                        if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragEnd={(e) => {
                        const node = e.target;
                        const nx = node.x();
                        const ny = node.y();
                        runDragScale(node, 1);
                        setElements((prev) =>
                          prev.map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x)),
                        );
                      }}
                      onTransformEnd={(e) => syncTransformToState(el.id, e.target)}
                      onMouseEnter={(e) => {
                        if (canEdit && tool === "select" && !sel) setHoverDeviceId(el.id);
                        if (!canEdit || tool !== "select" || sel) return;
                        e.currentTarget.opacity(1);
                      }}
                      onMouseLeave={(e) => {
                        setHoverDeviceId((z) => (z === el.id ? null : z));
                        e.currentTarget.opacity(sel ? 1 : isPublish ? 1 : 0.97);
                      }}
                      opacity={isPublish ? 1 : 0.97}
                    >
                      {pulse ? (
                        <DevicePulseHalo
                          cx={w / 2}
                          cy={h / 2}
                          mode={st === "alarm" ? "alarm" : "warning"}
                          onFrame={batchLayer}
                        />
                      ) : null}
                      <Rect
                        width={w}
                        height={h}
                        cornerRadius={10}
                        fill={isPublish ? "rgba(248, 250, 252, 0.12)" : "rgba(15, 23, 42, 0.18)"}
                        stroke={
                          sel
                            ? "rgba(96, 165, 250, 0.45)"
                            : dGlow
                              ? "rgba(203, 213, 245, 0.28)"
                              : isPublish
                                ? "rgba(226, 232, 240, 0.38)"
                                : "rgba(203, 213, 245, 0.16)"
                        }
                        strokeWidth={dStroke}
                        listening={false}
                      />
                      <Group
                        opacity={isPublish ? 1 : dGlow ? 1 : 0.94}
                        x={w / 2}
                        y={h / 2}
                        scaleX={symScale}
                        scaleY={symScale}
                        listening={false}
                      >
                        <DeviceGlyph kind={kind} statusKey={st} />
                      </Group>
                      <Text
                        text={(el.name ?? kind).toUpperCase()}
                        x={4}
                        y={h - 13}
                        width={w - 8}
                        align="center"
                        fill={isPublish ? "#f1f5f9" : "#cbd5f5"}
                        opacity={isPublish ? 0.94 : 0.88}
                        fontSize={pubFs(9)}
                        fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
                        fontStyle="normal"
                        letterSpacing={1.4}
                        listening={false}
                        ellipsis
                      />
                    </Group>
                  );
                })}
              {elements
                .filter((el) => el.type === "path" && (el.path_points?.length ?? 0) >= 6)
                .map((el) => {
                  const pts = el.path_points ?? [];
                  const sel = el.id === selectedId;
                  const sw = pubLine(Math.max(0.65, 1 / stageScale));
                  const pathFill = isPublish ? "rgba(56, 189, 248, 0.14)" : "rgba(56, 189, 248, 0.08)";
                  const pathStroke = sel
                    ? "rgba(96, 165, 250, 0.78)"
                    : isPublish
                      ? "rgba(186, 230, 253, 0.72)"
                      : "rgba(148, 197, 255, 0.52)";
                  return (
                    <Line
                      key={el.id}
                      points={pts}
                      closed
                      tension={PATH_LINE_TENSION}
                      fill={pathFill}
                      stroke={pathStroke}
                      strokeWidth={sw}
                      lineCap="round"
                      lineJoin="round"
                      listening={canEdit && tool === "select"}
                      hitStrokeWidth={Math.max(16, 14 / stageScale)}
                      onClick={() => canEdit && setSelectedId(el.id)}
                      onTap={() => canEdit && setSelectedId(el.id)}
                    />
                  );
                })}
              {canEdit && drawDraft && drawDraft.w > 0 && drawDraft.h > 0 ? (
                <Rect
                  x={drawDraft.x}
                  y={drawDraft.y}
                  width={drawDraft.w}
                  height={drawDraft.h}
                  cornerRadius={ZONE_RADIUS}
                  stroke="rgba(96, 165, 250, 0.55)"
                  strokeWidth={Math.max(0.85, 1.1 / stageScale)}
                  fill="rgba(148, 197, 255, 0.05)"
                  listening={false}
                />
              ) : null}
              {canEdit && tool === "place-device" ? (
                <Rect
                  x={-8000}
                  y={-8000}
                  width={20000}
                  height={20000}
                  fill="rgba(0,0,0,0.001)"
                  listening
                  onClick={onPlaceOverlayClick}
                />
              ) : null}
              {canEdit && tool === "place-door" ? (
                <Rect
                  x={-8000}
                  y={-8000}
                  width={20000}
                  height={20000}
                  fill="rgba(0,0,0,0.001)"
                  listening
                  onClick={onDoorOverlayClick}
                />
              ) : null}
              {canEdit && tool === "place-symbol" ? (
                <Rect
                  x={-8000}
                  y={-8000}
                  width={20000}
                  height={20000}
                  fill="rgba(0,0,0,0.001)"
                  listening
                  onClick={onSymbolOverlayClick}
                />
              ) : null}
              {canEdit && tool === "free-draw" ? (
                <Rect
                  x={-8000}
                  y={-8000}
                  width={20000}
                  height={20000}
                  fill="rgba(0,0,0,0.001)"
                  listening
                  onPointerDown={onFreeDrawPointerDown}
                />
              ) : null}
              <Transformer
                ref={transformerRef}
                rotateEnabled
                borderStroke="rgba(96, 165, 250, 0.55)"
                borderDash={[5, 4]}
                anchorStroke="rgba(203, 213, 245, 0.55)"
                anchorFill="rgba(15, 23, 42, 0.95)"
                anchorSize={9}
                padding={5}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < MIN_ZONE || newBox.height < MIN_ZONE) return oldBox;
                  if (tool !== "select") return newBox;
                  const sid = selectedId;
                  if (!sid) return newBox;
                  const sel = elements.find((u) => u.id === sid);
                  if (!sel || sel.type !== "zone") return newBox;
                  const snapped = snapAxisAlignedBox(
                    {
                      x: newBox.x,
                      y: newBox.y,
                      width: newBox.width,
                      height: newBox.height,
                      rotation: newBox.rotation ?? sel.rotation ?? 0,
                    },
                    elements,
                    sid,
                  );
                  return {
                    ...newBox,
                    x: snapped.x,
                    y: snapped.y,
                    width: snapped.width,
                    height: snapped.height,
                  };
                }}
                onTransform={() => {
                  const tr = transformerRef.current;
                  if (!tr || tool !== "select" || !selectedId) {
                    setSnapGuides([]);
                    return;
                  }
                  const sel = elements.find((u) => u.id === selectedId);
                  if (!sel || sel.type !== "zone") {
                    setSnapGuides([]);
                    return;
                  }
                  const nodes = tr.nodes();
                  if (nodes.length !== 1) return;
                  const node = nodes[0];
                  if (node.getClassName() !== "Rect") {
                    setSnapGuides([]);
                    return;
                  }
                  if (Math.abs(node.rotation()) > 1e-5) {
                    setSnapGuides([]);
                    return;
                  }
                  const r = node as Konva.Rect;
                  const sx = node.scaleX();
                  const sy = node.scaleY();
                  const guides = snapGuidesBetweenZones(
                    {
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(MIN_ZONE, r.width() * sx),
                      height: Math.max(MIN_ZONE, r.height() * sy),
                    },
                    elements,
                    selectedId,
                  );
                  setSnapGuides(guides);
                  batchLayer();
                }}
                onTransformEnd={() => setSnapGuides([])}
              />
            </Layer>
          </Stage>
        </div>
      </motion.div>

      <motion.aside
        className={`bp-props${isPublish ? " bp-props--publish" : ""}`}
        aria-label="Properties"
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...bpTransition.med, delay: 0.04 }}
      >
        <h3 style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--bp-muted)" }}>
          Properties
        </h3>
        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.p
              key="props-empty"
              className="bp-hint"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={bpTransition.med}
            >
              Select a room, device, symbol, or shape, or use tools on the canvas.
            </motion.p>
          ) : (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={bpTransition.med}
              style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}
            >
              <div className="bp-field">
                <label htmlFor="p-name">Name</label>
                <input
                  id="p-name"
                  value={selected.name ?? ""}
                  onChange={(e) => updateSelectedField({ name: e.target.value })}
                />
              </div>
              <div className="bp-field">
                <label htmlFor="p-type">Type</label>
                <input
                  id="p-type"
                  readOnly
                  value={
                    selected.type === "zone"
                      ? "Zone"
                      : selected.type === "door"
                        ? "Door"
                        : selected.type === "path"
                          ? "Freehand shape"
                          : selected.type === "symbol"
                            ? `Symbol (${selected.symbol_type ?? "?"})`
                            : selected.device_kind ?? "device"
                  }
                />
              </div>
              {selected.type === "door" && selected.wall_attachment ? (
                <div className="bp-field">
                  <label htmlFor="p-wall">Wall</label>
                  <input id="p-wall" readOnly value={selected.wall_attachment} title="Zone element id : edge : position along edge" />
                </div>
              ) : null}
              {selected.type === "path" && selected.path_points ? (
                <div className="bp-field">
                  <label htmlFor="p-verts">Vertices</label>
                  <input id="p-verts" readOnly value={String(selected.path_points.length / 2)} />
                </div>
              ) : null}
              {selected.type === "symbol" ? (
                <>
                  <div className="bp-field">
                    <label htmlFor="p-sym-type">Symbol type</label>
                    <input id="p-sym-type" readOnly value={selected.symbol_type ?? ""} title="Set when placed; extend SYMBOL_LIBRARY + SymbolGlyph for new icons" />
                  </div>
                  <div className="bp-field">
                    <label htmlFor="p-tags">Tags</label>
                    <textarea
                      id="p-tags"
                      rows={2}
                      value={(selected.symbol_tags ?? []).join(", ")}
                      placeholder="comma or newline separated"
                      onChange={(e) =>
                        updateSelectedField({ symbol_tags: parseTagsFromInput(e.target.value) })
                      }
                    />
                  </div>
                  <div className="bp-field">
                    <label htmlFor="p-notes">Notes</label>
                    <textarea
                      id="p-notes"
                      rows={3}
                      value={selected.symbol_notes ?? ""}
                      onChange={(e) => updateSelectedField({ symbol_notes: e.target.value || undefined })}
                    />
                  </div>
                </>
              ) : null}
              <div className="bp-field">
                <label>Position</label>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  <input
                    type="number"
                    value={Math.round(selected.x)}
                    readOnly={selected.type === "door" || selected.type === "path"}
                    title={
                      selected.type === "door"
                        ? "Derived from wall attachment"
                        : selected.type === "path"
                          ? "Bounding box min (shape is path_points)"
                          : undefined
                    }
                    onChange={(e) => updateSelectedField({ x: Number(e.target.value) || 0 })}
                  />
                  <input
                    type="number"
                    value={Math.round(selected.y)}
                    readOnly={selected.type === "door" || selected.type === "path"}
                    title={
                      selected.type === "door"
                        ? "Derived from wall attachment"
                        : selected.type === "path"
                          ? "Bounding box min (shape is path_points)"
                          : undefined
                    }
                    onChange={(e) => updateSelectedField({ y: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="bp-field">
                <label>Size</label>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  <input
                    type="number"
                    value={Math.round(selected.width ?? 0)}
                    readOnly={selected.type === "path"}
                    title={selected.type === "path" ? "BBox width (geometry is path_points)" : undefined}
                    onChange={(e) => {
                      const width = Math.max(12, Number(e.target.value) || 0);
                      if (selected.type === "path") return;
                      if (selected.type === "door") {
                        setElements((p) => {
                          const next = p.map((x) => (x.id === selectedId ? { ...x, width } : x));
                          return next.map((x) =>
                            x.id === selectedId && x.type === "door"
                              ? doorElementFromAttachment(x, next) ?? x
                              : x,
                          );
                        });
                      } else {
                        updateSelectedField({ width });
                      }
                    }}
                  />
                  <input
                    type="number"
                    value={Math.round(selected.height ?? 0)}
                    readOnly={selected.type === "path"}
                    title={selected.type === "path" ? "BBox height (geometry is path_points)" : undefined}
                    onChange={(e) => {
                      const height = Math.max(6, Number(e.target.value) || 0);
                      if (selected.type === "path") return;
                      if (selected.type === "door") {
                        setElements((p) => {
                          const next = p.map((x) => (x.id === selectedId ? { ...x, height } : x));
                          return next.map((x) =>
                            x.id === selectedId && x.type === "door"
                              ? doorElementFromAttachment(x, next) ?? x
                              : x,
                          );
                        });
                      } else {
                        updateSelectedField({ height });
                      }
                    }}
                  />
                </div>
              </div>
              {selected.type === "device" ? (
                <>
                  <div className="bp-field">
                    <label htmlFor="p-link">Linked device</label>
                    <select
                      id="p-link"
                      value={selected.linked_device_id ?? ""}
                      onChange={(e) =>
                        updateSelectedField({
                          linked_device_id: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">— None —</option>
                      {equipmentApi.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="bp-field">
                    <label htmlFor="p-zone">Zone assignment</label>
                    <select
                      id="p-zone"
                      value={selected.assigned_zone_id ?? ""}
                      onChange={(e) =>
                        updateSelectedField({
                          assigned_zone_id: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">— None —</option>
                      {zonesApi.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="bp-hint">
                    Status tint (mock): linked devices cycle neutral / normal / warning / alarm by id hash.
                  </p>
                </>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </div>
  );
}
