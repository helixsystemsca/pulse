"use client";

import { animate, AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { apiFetch, isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { pulseApp } from "@/lib/pulse-app";
import { canAccessPulseTenantApis, readSession } from "@/lib/pulse-session";
import { emitOnboardingMaybeUpdated } from "@/lib/onboarding-events";
import { processFreehandPath } from "@/lib/blueprint-freehand-path";
import { bpDuration, bpEase, bpTransition } from "@/lib/motion-presets";
import type { BlueprintDesignerTool, BlueprintElement, TaskOverlay } from "./blueprint-types";
export type { BlueprintElement, BlueprintState, BlueprintHistoryState, TaskOverlay } from "./blueprint-types";
import { BlueprintSymbolPanel } from "./BlueprintSymbolPanel";
import { BlueprintTasksPanel } from "./BlueprintTasksPanel";
import { BlueprintToolRail } from "./BlueprintToolRail";
import type { SymbolLibraryId } from "./blueprint-symbols-shared";
export { SYMBOL_LIBRARY, type SymbolLibraryId } from "./blueprint-symbols-shared";
import { useBlueprintHistory } from "./useBlueprintHistory";
import "./blueprint-designer.css";

type Tool = BlueprintDesignerTool;
type DeviceKind = "pump" | "tank" | "sensor" | "generic";

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

type ApiTask = {
  id: string;
  title: string;
  mode: "steps" | "paragraph";
  content: unknown;
  linked_element_ids?: string[] | null;
};

type BlueprintDetail = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  elements: ApiElement[];
  tasks?: ApiTask[] | null;
};

function mapApiTasks(raw: ApiTask[] | undefined | null): TaskOverlay[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: TaskOverlay[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const id = String(t.id ?? "");
    if (!id) continue;
    const mode = t.mode === "paragraph" ? "paragraph" : "steps";
    let content: string | string[];
    if (mode === "paragraph") {
      content = Array.isArray(t.content) ? t.content.map(String).join("\n") : String(t.content ?? "");
    } else {
      const c = t.content;
      content = Array.isArray(c) ? c.map(String) : [String(c ?? "")];
    }
    const links = Array.isArray(t.linked_element_ids) ? t.linked_element_ids.map(String) : [];
    out.push({
      id,
      title: String(t.title ?? "Task"),
      mode,
      content,
      linked_element_ids: links,
    });
  }
  return out;
}

const GRID = 32;
const DEVICE_DEFAULT = 44;
const SYMBOL_DEFAULT = 40;
/** Space reserved under the glyph for the label (font line + gap below icon). */
const SYMBOL_LABEL_BAND_GAP = 6;
/** Slight upward shift so glyph clears the label band without changing glyph geometry. */
const SYMBOL_ICON_Y_NUDGE = 3;
const MIN_ZONE = 24;
/** Zone edge snap distance (world px) */
const SNAP_PX = 8;
const DOOR_ALONG_DEFAULT = 32;
const DOOR_DEPTH_DEFAULT = 10;
const MIN_DOOR_ALONG = 14;
const MAX_DOOR_ALONG = 280;
/** Larger = transformer activates before touching the stroke. */
const ZONE_EDGE_HIT_PX = 22;
const TRANSFORMER_ANCHOR_PX = 14;
const TRANSFORMER_PADDING_PX = 12;
/** Max distance from click to zone edge to place a door (world px) */
const WALL_SNAP_PX = 26;
/** Match blueprint canvas background (--bp-bg) for wall “cut” overlay */
const CANVAS_BG_CUT = "#0f172a";

/** Free-draw: min distance between raw samples (world px) */
const FREE_DRAW_SAMPLE_DIST = 1.1;
/** Konva Line tension — 0 because `path_points` are pre-smoothed (simplify-js + quadratic Bézier sampling). */
const PATH_LINE_TENSION = 0;

type WallEdgeIdx = 0 | 1 | 2 | 3;

/** Wall placement for doors: rectangle zone edge or polygon edge index. */
type WallAttach =
  | { kind: "rect"; zoneId: string; edge: WallEdgeIdx; t: number }
  | { kind: "poly"; zoneId: string; edgeIdx: number; t: number };

type ZoneAabb = { L: number; R: number; T: number; B: number };

function zonePolygonFlat(el: BlueprintElement): number[] | null {
  if (el.type !== "zone" || !el.path_points || el.path_points.length < 6) return null;
  return el.path_points;
}

/** World-space axis-aligned bounds for a zone (rect, rotated rect, or polygon outline). */
function zoneAabb(el: BlueprintElement): ZoneAabb {
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
): WallAttach | null {
  let best: { att: WallAttach; d: number } | null = null;
  for (const z of elements) {
    if (z.type !== "zone") continue;
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

function serializeWallAttach(a: WallAttach): string {
  if (a.kind === "rect") return `${a.zoneId}:${a.edge}:${a.t.toFixed(4)}`;
  return `${a.zoneId}:poly:${a.edgeIdx}:${a.t.toFixed(4)}`;
}

function parseWallAttach(s: string | undefined): WallAttach | null {
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

/** Inward unit normal for polygon edge (toward centroid). */
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

function doorElementFromAttachment(door: BlueprintElement, elements: BlueprintElement[]): BlueprintElement | null {
  const p = parseWallAttach(door.wall_attachment);
  if (!p) return null;
  const zone = elements.find((z) => z.id === p.zoneId && z.type === "zone");
  if (!zone) return null;
  let along = door.width ?? DOOR_ALONG_DEFAULT;
  const maxAlong = doorAlongUpperBound(zone, p);
  along = Math.min(Math.max(along, MIN_DOOR_ALONG), Math.min(MAX_DOOR_ALONG, maxAlong));
  const depth = door.height ?? DOOR_DEPTH_DEFAULT;
  const { cx, cy, rot } = doorLayoutFromAttach(zone, p, along, depth);
  return { ...door, x: cx, y: cy, rotation: rot, width: along, height: depth };
}

function relayoutAttachedDoors(elements: BlueprintElement[], zoneId: string): BlueprintElement[] {
  return elements.map((e) => {
    if (e.type !== "door") return e;
    const p = parseWallAttach(e.wall_attachment);
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

/** Rotate flat path x,y pairs 90° clockwise around (cx, cy); Y-down canvas coords (matches Konva rotation sense). */
function rotatePathFlat90Cw(flat: number[], cx: number, cy: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const x = flat[i]!;
    const y = flat[i + 1]!;
    const xr = cx + (y - cy);
    const yr = cy + (x - cx);
    out.push(xr, yr);
  }
  return out;
}

function ptKeyMerge(x: number, y: number) {
  return `${Math.round(x * 1e4)}:${Math.round(y * 1e4)}`;
}

function undirectedEdgeKeyMerge(a: [number, number], b: [number, number]): string {
  const ka = ptKeyMerge(a[0], a[1]);
  const kb = ptKeyMerge(b[0], b[1]);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function polygonSignedAreaFlat(flat: number[]): number {
  let s = 0;
  const n = flat.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    s += flat[i * 2]! * flat[j * 2 + 1]! - flat[j * 2]! * flat[i * 2 + 1]!;
  }
  return s / 2;
}

function fuseDirectedBoundaryToRing(boundary: Array<[[number, number], [number, number]]>): number[] | null {
  const adj = new Map<string, [number, number][]>();
  const kf = (p: [number, number]) => ptKeyMerge(p[0], p[1]);
  const add = (a: [number, number], b: [number, number]) => {
    const ka = kf(a);
    if (!adj.has(ka)) adj.set(ka, []);
    adj.get(ka)!.push(b);
  };
  for (const [a, b] of boundary) {
    add(a, b);
    add(b, a);
  }
  let start: [number, number] | null = null;
  for (const k of adj.keys()) {
    const [sx, sy] = k.split(":").map(Number) as [number, number];
    if (!start || sx < start[0] || (sx === start[0] && sy < start[1])) start = [sx, sy];
  }
  if (!start) return null;
  const flat: number[] = [];
  let cur = start;
  let prev: [number, number] | null = null;
  for (let step = 0; step < boundary.length * 4 + 12; step++) {
    flat.push(cur[0], cur[1]);
    const neigh = adj.get(kf(cur)) ?? [];
    const candidates = neigh.filter((nb) => !prev || nb[0] !== prev[0] || nb[1] !== prev[1]);
    let next: [number, number] | null = null;
    if (candidates.length === 1) next = candidates[0]!;
    else if (candidates.length === 2 && !prev) {
      next = candidates[0]![0] < candidates[1]![0] || (candidates[0]![0] === candidates[1]![0] && candidates[0]![1] <= candidates[1]![1]) ? candidates[0]! : candidates[1]!;
    } else break;
    if (step >= 2 && next[0] === start[0] && next[1] === start[1]) break;
    prev = cur;
    cur = next;
  }
  return flat.length >= 6 ? flat : null;
}

function rectLtrbFromAxisZone(z: BlueprintElement): { L: number; R: number; T: number; B: number } | null {
  if (z.type !== "zone" || zonePolygonFlat(z) || (z.rotation ?? 0) !== 0) return null;
  const w = z.width ?? 120;
  const h = z.height ?? 80;
  return { L: z.x, R: z.x + w, T: z.y, B: z.y + h };
}

function mergeAxisAlignedRectsToZoneElement(
  keepId: string,
  name: string,
  r1: { L: number; R: number; T: number; B: number },
  r2: { L: number; R: number; T: number; B: number },
): BlueprintElement | null {
  const eps = 1e-4;
  const overlapX = Math.min(r1.R, r2.R) - Math.max(r1.L, r2.L);
  const overlapY = Math.min(r1.B, r2.B) - Math.max(r1.T, r2.T);
  if (overlapX > eps && overlapY > eps) return null;
  if (overlapX < -1e-2 || overlapY < -1e-2) return null;

  const xs = [...new Set([r1.L, r1.R, r2.L, r2.R])].sort((a, b) => a - b);
  const ys = [...new Set([r1.T, r1.B, r2.T, r2.B])].sort((a, b) => a - b);
  const grid: boolean[][] = [];
  for (let j = 0; j < ys.length - 1; j++) {
    const row: boolean[] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const cx = (xs[i]! + xs[i + 1]!) / 2;
      const cy = (ys[j]! + ys[j + 1]!) / 2;
      const in1 = cx >= r1.L - eps && cx <= r1.R + eps && cy >= r1.T - eps && cy <= r1.B + eps;
      const in2 = cx >= r2.L - eps && cx <= r2.R + eps && cy >= r2.T - eps && cy <= r2.B + eps;
      row.push(in1 || in2);
    }
    grid.push(row);
  }

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return null;

  const directed: Array<[[number, number], [number, number]]> = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (!grid[j]![i]) continue;
      const L = xs[i]!;
      const R = xs[i + 1]!;
      const T = ys[j]!;
      const B = ys[j + 1]!;
      if (j === 0 || !grid[j - 1]![i]) directed.push([[L, T], [R, T]]);
      if (j === rows - 1 || !grid[j + 1]![i]) directed.push([[R, B], [L, B]]);
      if (i === 0 || !grid[j]![i - 1]) directed.push([[L, B], [L, T]]);
      if (i === cols - 1 || !grid[j]![i + 1]) directed.push([[R, T], [R, B]]);
    }
  }

  const ec = new Map<string, { dir: [[number, number], [number, number]]; n: number }>();
  for (const seg of directed) {
    const [a, b] = seg;
    const k = undirectedEdgeKeyMerge(a, b);
    const ex = ec.get(k);
    if (!ex) ec.set(k, { dir: seg, n: 1 });
    else ex.n += 1;
  }
  const boundary: Array<[[number, number], [number, number]]> = [];
  for (const { dir, n } of ec.values()) {
    if (n % 2 === 1) boundary.push(dir);
  }
  const ring = fuseDirectedBoundaryToRing(boundary);
  if (!ring) return null;

  const areaExpect = (r1.R - r1.L) * (r1.B - r1.T) + (r2.R - r2.L) * (r2.B - r2.T);
  const areaGot = Math.abs(polygonSignedAreaFlat(ring));
  if (Math.abs(areaGot - areaExpect) > 2) return null;

  const bb = bboxFromPathPoints(ring);
  const isAxisRect = Math.abs(areaGot - bb.w * bb.h) < 1.5;
  if (isAxisRect) {
    return {
      id: keepId,
      type: "zone",
      x: bb.minX,
      y: bb.minY,
      width: bb.w,
      height: bb.h,
      rotation: 0,
      name,
    };
  }
  return {
    id: keepId,
    type: "zone",
    x: bb.minX,
    y: bb.minY,
    width: bb.w,
    height: bb.h,
    rotation: 0,
    name,
    path_points: ring,
  };
}

function isTypingKeyboardTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(el.closest("input, textarea, select, [contenteditable='true']"));
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
const ZONE_OUTLINE_HOVER = "rgba(224, 242, 254, 0.96)";
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

/** Pointer in world coords from client position (works during window-level drag). */
function getWorldFromClient(stage: Konva.Stage | null, clientX: number, clientY: number): { x: number; y: number } | null {
  if (!stage) return null;
  const rect = stage.container().getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return {
    x: (sx - stage.x()) / stage.scaleX(),
    y: (sy - stage.y()) / stage.scaleY(),
  };
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const NUDGE_WORLD = 8;
const UNDO_HISTORY_MAX = 50;

/** Axis-aligned world bounds for marquee / selection union. */
function elementWorldAabb(el: BlueprintElement): { L: number; R: number; T: number; B: number } | null {
  if (el.type === "path" && el.path_points && el.path_points.length >= 6) {
    const pts = el.path_points;
    let L = Infinity;
    let R = -Infinity;
    let T = Infinity;
    let B = -Infinity;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      L = Math.min(L, pts[i]);
      R = Math.max(R, pts[i]);
      T = Math.min(T, pts[i + 1]);
      B = Math.max(B, pts[i + 1]);
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
  if (el.type === "zone") return zoneAabb(el);
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

function aabbOverlap(
  a: { L: number; R: number; T: number; B: number },
  b: { L: number; R: number; T: number; B: number },
): boolean {
  return !(a.R < b.L || a.L > b.R || a.B < b.T || a.T > b.B);
}

function elementIdsInMarquee(all: BlueprintElement[], m: { L: number; R: number; T: number; B: number }): string[] {
  const out: string[] = [];
  for (const el of all) {
    const a = elementWorldAabb(el);
    if (!a) continue;
    if (aabbOverlap(m, a)) out.push(el.id);
  }
  return out;
}

function unionSelectionAabb(ids: Set<string>, all: BlueprintElement[]): { L: number; R: number; T: number; B: number } | null {
  let L = Infinity;
  let R = -Infinity;
  let T = Infinity;
  let B = -Infinity;
  let any = false;
  for (const el of all) {
    if (!ids.has(el.id)) continue;
    const a = elementWorldAabb(el);
    if (!a) continue;
    any = true;
    L = Math.min(L, a.L);
    R = Math.max(R, a.R);
    T = Math.min(T, a.T);
    B = Math.max(B, a.B);
  }
  if (!any) return null;
  return { L, R, T, B };
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

function blueprintApiUserMessage(err: unknown): string {
  const { message, status } = parseClientApiError(err);
  if (status === 401) {
    if (message === "company_context_required_impersonate") {
      return "Sign in with a company user account to save blueprints. System admins: use Impersonate, then try again.";
    }
    if (message === "not_authenticated" || message === "invalid_token") {
      return "Your session is missing or no longer valid. Sign out, sign in again, then save.";
    }
    if (message === "Not authenticated" || message === "Invalid token") {
      return "Your session is missing or no longer valid. Sign out, sign in again, then save.";
    }
    return "Could not authorize this request (401). Sign out and sign in again, or confirm this site uses the same API URL as your account (NEXT_PUBLIC_API_URL).";
  }
  if (status === 403 && message === "feature_disabled") {
    return "This action is not enabled for your organization (403). Ask an admin to enable the required module.";
  }
  if (status === 403) {
    if (message === "This resource requires a company user account") {
      return "Blueprints are saved per organization. System admins: use Impersonate, then try again.";
    }
    return message !== "Request failed" && !String(message).startsWith("API ")
      ? message
      : "You do not have permission for this blueprint action (403).";
  }
  return message;
}

export type BlueprintDesignerProps = {
  /**
   * Marketing-site mode: no tenant API list/save/load or zone/equipment hooks.
   * Editor, publish preview, PNG/PDF export, and local undo still work.
   */
  standalone?: boolean;
};

export function BlueprintDesigner({ standalone = false }: BlueprintDesignerProps) {
  const {
    blueprint,
    updateBlueprint,
    replaceBlueprint,
    checkpointBlueprint,
    undoBlueprint,
    redoBlueprint,
    resetBlueprint,
  } = useBlueprintHistory({ maxDepth: UNDO_HISTORY_MAX });
  const elements = blueprint.elements;
  const tasks = blueprint.tasks;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marqueeBox, setMarqueeBox] = useState<{ L: number; R: number; T: number; B: number } | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [placeKind, setPlaceKind] = useState<DeviceKind>("generic");
  const [placeSymbolKind, setPlaceSymbolKind] = useState<SymbolLibraryId>("tree");
  const [symbolPanelOpen, setSymbolPanelOpen] = useState(false);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [blueprintName, setBlueprintName] = useState("Untitled blueprint");
  const [list, setList] = useState<BlueprintSummary[]>([]);
  const [stageSize, setStageSize] = useState({ w: 800, h: 520 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [drawDraft, setDrawDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [designerMode, setDesignerMode] = useState<"edit" | "publish">("edit");

  const [zonesApi, setZonesApi] = useState<{ id: string; name: string }[]>([]);
  const [equipmentApi, setEquipmentApi] = useState<{ id: string; name: string }[]>([]);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [linkingForTaskId, setLinkingForTaskId] = useState<string | null>(null);
  const [taskStepHighlight, setTaskStepHighlight] = useState<{ taskId: string; stepIndex: number } | null>(
    null,
  );
  const [taskStepPin, setTaskStepPin] = useState<{ taskId: string; stepIndex: number } | null>(null);
  const [canvasHoverElementId, setCanvasHoverElementId] = useState<string | null>(null);

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const selectedNodeRef = useRef<Konva.Node | null>(null);
  const doorInnerRefMap = useRef<Map<string, Konva.Rect>>(new Map());
  const drawOriginRef = useRef<{ x: number; y: number } | null>(null);
  const drawDraftRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const dragAnimRef = useRef<ReturnType<typeof animate> | null>(null);
  const zoomAnimRef = useRef<ReturnType<typeof animate> | null>(null);
  const stagePosRef = useRef(stagePos);
  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);
  const [hoverDeviceId, setHoverDeviceId] = useState<string | null>(null);
  const [hoverSymbolId, setHoverSymbolId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [freeDrawPreview, setFreeDrawPreview] = useState<number[] | null>(null);
  const freeDrawAccumRef = useRef<number[]>([]);
  const freeDrawWinCleanupRef = useRef<(() => void) | null>(null);
  const elementsRef = useRef(elements);
  const selectedIdsRef = useRef(selectedIds);
  const canEditRef = useRef(true);
  const stageScaleRef = useRef(stageScale);
  type GroupDragState = { primaryId: string; starts: Map<string, { x: number; y: number }>; pathFlats: Map<string, number[]> };
  const groupDragRef = useRef<GroupDragState | null>(null);
  const transformUndoPrimedRef = useRef(false);
  const linkingForTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    linkingForTaskIdRef.current = linkingForTaskId;
  }, [linkingForTaskId]);

  const taskGlowIds = useMemo(() => {
    const h = taskStepHighlight ?? taskStepPin;
    if (!h) return new Set<string>();
    const t = tasks.find((x) => x.id === h.taskId);
    if (!t) return new Set<string>();
    return new Set(t.linked_element_ids);
  }, [taskStepHighlight, taskStepPin, tasks]);

  const emphasizedTaskIds = useMemo(() => {
    if (!canvasHoverElementId) return new Set<string>();
    const s = new Set<string>();
    for (const t of tasks) {
      if (t.linked_element_ids.includes(canvasHoverElementId)) s.add(t.id);
    }
    return s;
  }, [canvasHoverElementId, tasks]);

  /** Commits blueprint changes: previous present → past, new state → present, clears future. */
  const commitElements = useCallback(
    (updater: BlueprintElement[] | ((p: BlueprintElement[]) => BlueprintElement[])) => {
      updateBlueprint((bp) => {
        const next = typeof updater === "function" ? updater(bp.elements) : updater;
        const idSet = new Set(next.map((e) => e.id));
        const nextTasks = bp.tasks.map((t) => ({
          ...t,
          linked_element_ids: t.linked_element_ids.filter((id) => idSet.has(id)),
        }));
        return { ...bp, elements: next, tasks: nextTasks };
      });
    },
    [updateBlueprint],
  );

  const replaceElements = useCallback(
    (updater: BlueprintElement[] | ((p: BlueprintElement[]) => BlueprintElement[])) => {
      replaceBlueprint((bp) => {
        const next = typeof updater === "function" ? updater(bp.elements) : updater;
        if (next === bp.elements) return bp;
        return { ...bp, elements: next };
      });
    },
    [replaceBlueprint],
  );

  const patchTask = useCallback(
    (id: string, patch: Partial<TaskOverlay>) => {
      updateBlueprint((bp) => ({
        ...bp,
        tasks: bp.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
    },
    [updateBlueprint],
  );

  const undo = useCallback(() => {
    const restored = undoBlueprint();
    if (!restored) return;
    setSnapGuides([]);
    transformUndoPrimedRef.current = false;
    const valid = new Set(restored.elements.map((e) => e.id));
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)));
  }, [undoBlueprint]);

  const redo = useCallback(() => {
    const restored = redoBlueprint();
    if (!restored) return;
    setSnapGuides([]);
    transformUndoPrimedRef.current = false;
    const valid = new Set(restored.elements.map((e) => e.id));
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)));
  }, [redoBlueprint]);

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
    setIsDraggingSelection(false);
    freeDrawWinCleanupRef.current?.();
    freeDrawWinCleanupRef.current = null;
    freeDrawAccumRef.current = [];
    setFreeDrawPreview(null);
    setLinkingForTaskId(null);
    setTaskStepHighlight(null);
    setTaskStepPin(null);
  }, [tool]);

  useEffect(() => () => zoomAnimRef.current?.stop(), []);

  const runDragScale = useCallback((node: Konva.Node, to: number) => {
    dragAnimRef.current?.stop();
    const from = node.scaleX();
    if (Math.abs(from - to) < 0.002) return;
    dragAnimRef.current = animate(from, to, {
      duration: bpDuration.fast,
      ease: bpEase,
      onUpdate: (v) => {
        node.scaleX(v);
        node.scaleY(v);
        layerRef.current?.batchDraw();
      },
    });
  }, []);

  const isPublish = designerMode === "publish";
  const canEdit = !isPublish;

  useEffect(() => {
    if (!canEdit) setSymbolPanelOpen(false);
  }, [canEdit]);

  useEffect(() => {
    if (!isPublish) return;
    setLinkingForTaskId(null);
    setSelectedTaskId(null);
    setTaskStepHighlight(null);
    setTaskStepPin(null);
  }, [isPublish]);
  const selectedSingleId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selected = selectedSingleId ? elements.find((e) => e.id === selectedSingleId) ?? null : null;

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  useEffect(() => {
    canEditRef.current = canEdit;
  }, [canEdit]);
  useEffect(() => {
    stageScaleRef.current = stageScale;
  }, [stageScale]);
  useEffect(() => {
    stagePosRef.current = stagePos;
  }, [stagePos]);

  const selectionBounds =
    selectedIds.length > 1 ? unionSelectionAabb(new Set(selectedIds), elements) : null;

  const mergePair = useMemo(() => {
    if (selectedIds.length !== 2) return null;
    const a = elements.find((e) => e.id === selectedIds[0]);
    const b = elements.find((e) => e.id === selectedIds[1]);
    if (!a || !b || a.type !== "zone" || b.type !== "zone") return null;
    const r1 = rectLtrbFromAxisZone(a);
    const r2 = rectLtrbFromAxisZone(b);
    if (!r1 || !r2) return null;
    if (!mergeAxisAlignedRectsToZoneElement(a.id, "", r1, r2)) return null;
    return { a, b, r1, r2 };
  }, [selectedIds, elements]);

  const mergeSelectedRooms = useCallback(() => {
    if (!mergePair || selectedIds.length !== 2) return;
    const { a, b, r1, r2 } = mergePair;
    const keepId = selectedIds[0]!;
    const name = [a.name, b.name].filter(Boolean).join(" · ").slice(0, 120) || "Merged room";
    checkpointBlueprint();
    commitElements((prev) => {
      const touchesMergedRoom = (e: BlueprintElement) => {
        if (e.type !== "door") return false;
        const p = parseWallAttach(e.wall_attachment);
        return Boolean(p && (p.zoneId === a.id || p.zoneId === b.id));
      };
      const filtered = prev.filter((e) => !touchesMergedRoom(e));
      const merged = mergeAxisAlignedRectsToZoneElement(keepId, name, r1, r2);
      if (!merged) return prev;
      const rest = filtered.filter((e) => e.id !== a.id && e.id !== b.id);
      return relayoutAllDoors([...rest, merged]);
    });
    setSelectedIds([keepId]);
    setSnapGuides([]);
  }, [mergePair, selectedIds, commitElements, checkpointBlueprint]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (!canEditRef.current) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && ((e.shiftKey && e.key.toLowerCase() === "z") || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setSymbolPanelOpen(false);
        setSelectedIds([]);
        setSnapGuides([]);
        setLinkingForTaskId(null);
        setTaskStepHighlight(null);
        setTaskStepPin(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIdsRef.current.length === 0) return;
        e.preventDefault();
        const drop = new Set(selectedIdsRef.current);
        commitElements((prev) => relayoutAllDoors(prev.filter((el) => !drop.has(el.id))));
        setSelectedIds([]);
        setSnapGuides([]);
        return;
      }
      const ids = selectedIdsRef.current;
      if (ids.length === 0) return;
      const step = e.shiftKey ? NUDGE_WORLD * 5 : NUDGE_WORLD;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;
      e.preventDefault();
      const idSet = new Set(ids);
      commitElements((prev) => {
        const next = prev.map((el) => {
          if (!idSet.has(el.id)) return el;
          if (el.type === "door") return el;
          if (el.type === "path" && el.path_points && el.path_points.length >= 6) {
            const flat = el.path_points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
            const bb = bboxFromPathPoints(flat);
            return { ...el, path_points: flat, x: bb.minX, y: bb.minY, width: bb.w, height: bb.h };
          }
          if (el.type === "zone" && el.path_points && el.path_points.length >= 6) {
            const flat = el.path_points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
            const bb = bboxFromPathPoints(flat);
            return { ...el, path_points: flat, x: bb.minX, y: bb.minY, width: bb.w, height: bb.h };
          }
          return { ...el, x: el.x + dx, y: el.y + dy };
        });
        let out = next;
        for (const el of next) {
          if (idSet.has(el.id) && el.type === "zone") out = relayoutAttachedDoors(out, el.id);
        }
        return relayoutAllDoors(out);
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, commitElements]);
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
    if (standalone) {
      setList([]);
      return;
    }
    try {
      const rows = await apiFetch<BlueprintSummary[]>("/api/blueprints");
      setList(rows);
      setError(null);
    } catch (e) {
      setError(blueprintApiUserMessage(e));
    }
  }, [standalone]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (standalone) {
      setZonesApi([]);
      setEquipmentApi([]);
      return;
    }
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
  }, [standalone]);

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
        if (isTypingKeyboardTarget(e.target)) return;
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (isTypingKeyboardTarget(e.target)) return;
      setSpaceDown(false);
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
      resetBlueprint({
        elements: relayoutAllDoors(d.elements.map(mapApiElement)),
        tasks: mapApiTasks(d.tasks),
      });
      setSelectedIds([]);
      setError(null);
    } catch (e) {
      setError(blueprintApiUserMessage(e));
    }
  };

  const saveBlueprint = async () => {
    setSaving(true);
    setError(null);
    if (standalone) {
      setError(
        "This public demo does not save to the cloud. Use Publish → Download PNG/PDF, or sign in on Pulse under Zones → Blueprint designer.",
      );
      setSaving(false);
      return;
    }
    if (isApiMode()) {
      const s = readSession();
      if (!s?.access_token) {
        setError("Sign in to save blueprints. If you were signed in, your session may have expired.");
        setSaving(false);
        return;
      }
      if (!canAccessPulseTenantApis(s)) {
        setError(
          "Blueprints are saved per organization. System administrators: use Impersonate on a company user, then save again.",
        );
        setSaving(false);
        return;
      }
    }
    try {
      const payload = {
        name: blueprintName.trim() || "Untitled blueprint",
        elements: toApiPayload(elements),
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          mode: t.mode,
          content: t.content,
          linked_element_ids: t.linked_element_ids,
        })),
      };
      if (blueprintId) {
        const d = await apiFetch<BlueprintDetail>(`/api/blueprints/${blueprintId}`, {
          method: "PUT",
          json: payload,
        });
        resetBlueprint({
          elements: relayoutAllDoors(d.elements.map(mapApiElement)),
          tasks: mapApiTasks(d.tasks),
        });
      } else {
        const d = await apiFetch<BlueprintDetail>("/api/blueprints", { method: "POST", json: payload });
        setBlueprintId(d.id);
        resetBlueprint({
          elements: relayoutAllDoors(d.elements.map(mapApiElement)),
          tasks: mapApiTasks(d.tasks),
        });
      }
      await refreshList();
      emitOnboardingMaybeUpdated();
    } catch (e) {
      setError(blueprintApiUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const newBlueprint = () => {
    setBlueprintId(null);
    setBlueprintName("Untitled blueprint");
    resetBlueprint({ elements: [], tasks: [] });
    setSelectedIds([]);
    setTool("select");
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    zoomAnimRef.current?.stop();
    const scaleBy = 1.065;
    const fromScale = stageScaleRef.current;
    const fromPos = stagePosRef.current;
    const targetScale = e.evt.deltaY > 0 ? fromScale / scaleBy : fromScale * scaleBy;
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, targetScale));
    if (Math.abs(clamped - fromScale) < 1e-6) return;

    const wx = (pointer.x - fromPos.x) / fromScale;
    const wy = (pointer.y - fromPos.y) / fromScale;
    const toPos = {
      x: pointer.x - wx * clamped,
      y: pointer.y - wy * clamped,
    };

    zoomAnimRef.current = animate(0, 1, {
      duration: 0.12,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: (t) => {
        const sc = fromScale + (clamped - fromScale) * t;
        const px = fromPos.x + (toPos.x - fromPos.x) * t;
        const py = fromPos.y + (toPos.y - fromPos.y) * t;
        stageScaleRef.current = sc;
        stagePosRef.current = { x: px, y: py };
        setStageScale(sc);
        setStagePos({ x: px, y: py });
      },
      onComplete: () => {
        zoomAnimRef.current = null;
      },
    });
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
    commitElements((prev) => [
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
    setSelectedIds([id]);
    setTool("select");
  };

  const placeDeviceAt = (x: number, y: number) => {
    const id = crypto.randomUUID();
    const w = DEVICE_DEFAULT;
    const h = DEVICE_DEFAULT;
    commitElements((prev) => [
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
    setSelectedIds([id]);
    setTool("select");
  };

  const placeSymbolAt = (cx: number, cy: number) => {
    const id = crypto.randomUUID();
    const w = SYMBOL_DEFAULT;
    const h = SYMBOL_DEFAULT;
    const st = placeSymbolKind;
    const label = st.charAt(0).toUpperCase() + st.slice(1);
    commitElements((prev) => [
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
    setSelectedIds([id]);
    setTool("select");
  };

  const placeDoorAt = (px: number, py: number) => {
    let createdId: string | null = null;
    commitElements((prev) => {
      const hit = nearestWallHit(px, py, prev);
      if (!hit) return prev;
      const zone = prev.find((z) => z.id === hit.zoneId && z.type === "zone");
      if (!zone) return prev;
      const id = crypto.randomUUID();
      const along = DOOR_ALONG_DEFAULT;
      const depth = DOOR_DEPTH_DEFAULT;
      const wall_attachment = serializeWallAttach(hit);
      const { cx, cy, rot } = doorLayoutFromAttach(zone, hit, along, depth);
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
      setSelectedIds([createdId]);
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
        commitElements((prev) => [
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
        setSelectedIds([id]);
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

  const initMultiDragIfNeeded = useCallback((primaryId: string) => {
    const currentElements = elementsRef.current;
    const ids = selectedIdsRef.current;
    if (ids.length < 2 || !ids.includes(primaryId)) {
      groupDragRef.current = null;
      return;
    }
    const starts = new Map<string, { x: number; y: number }>();
    const pathFlats = new Map<string, number[]>();
    for (const id of ids) {
      const o = currentElements.find((x) => x.id === id);
      if (!o || o.type === "door") continue;
      if (o.type === "path" && o.path_points && o.path_points.length >= 6) {
        /** Free-draw paths render as a `Line` at origin with absolute `points` — match Konva node for multi-drag. */
        starts.set(id, { x: 0, y: 0 });
        pathFlats.set(id, [...o.path_points]);
      } else {
        starts.set(id, { x: o.x, y: o.y });
      }
    }
    const prim = currentElements.find((x) => x.id === primaryId);
    if (prim && prim.type === "zone" && zonePolygonFlat(prim) && ids.length > 1) {
      groupDragRef.current = null;
      return;
    }
    if (!starts.has(primaryId)) {
      groupDragRef.current = null;
      return;
    }
    groupDragRef.current = { primaryId, starts, pathFlats };
  }, []);

  const handleSelectElementClick = useCallback(
    (e: Konva.KonvaEventObject<Event>, id: string) => {
      if (!canEditRef.current) return;
      const lid = linkingForTaskIdRef.current;
      if (lid) {
        e.cancelBubble = true;
        updateBlueprint((bp) => ({
          ...bp,
          tasks: bp.tasks.map((t) =>
            t.id !== lid
              ? t
              : {
                  ...t,
                  linked_element_ids: t.linked_element_ids.includes(id)
                    ? t.linked_element_ids.filter((x) => x !== id)
                    : [...t.linked_element_ids, id],
                },
          ),
        }));
        return;
      }
      const ne = e.evt as MouseEvent | TouchEvent;
      const shift = "shiftKey" in ne ? ne.shiftKey : false;
      if (shift) {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      } else {
        setSelectedIds([id]);
      }
      setTaskStepPin(null);
    },
    [updateBlueprint],
  );

  const beginMarqueeSelect = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (linkingForTaskId) return;
    if (!canEdit || tool !== "select" || e.evt.button !== 0 || spaceDown) return;
    e.cancelBubble = true;
    const st = e.target.getStage();
    const w0 = getWorldFromStage(st);
    if (!w0) return;
    const cx0 = e.evt.clientX;
    const cy0 = e.evt.clientY;
    const x0 = w0.x;
    const y0 = w0.y;

    const move = (ev: MouseEvent) => {
      const st2 = stageRef.current;
      const w = getWorldFromClient(st2, ev.clientX, ev.clientY);
      if (!w) return;
      setMarqueeBox({
        L: Math.min(x0, w.x),
        R: Math.max(x0, w.x),
        T: Math.min(y0, w.y),
        B: Math.max(y0, w.y),
      });
    };

    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setMarqueeBox(null);
      const w = getWorldFromClient(stageRef.current, ev.clientX, ev.clientY);
      const clickLike = Math.hypot(ev.clientX - cx0, ev.clientY - cy0) < 8;
      if (clickLike) {
        if (!ev.shiftKey) {
          setSelectedIds([]);
          setSnapGuides([]);
        }
        return;
      }
      if (!w) return;
      const L = Math.min(x0, w.x);
      const R = Math.max(x0, w.x);
      const T = Math.min(y0, w.y);
      const B = Math.max(y0, w.y);
      const picked = elementIdsInMarquee(elementsRef.current, { L, R, T, B });
      if (ev.shiftKey) setSelectedIds((prev) => [...new Set([...prev, ...picked])]);
      else setSelectedIds(picked);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  /** Applies shared translation to all items in `groupDragRef` from primary Konva node position. */
  const flushMultiDragMove = (primaryId: string, node: Konva.Node) => {
    const g = groupDragRef.current;
    if (!g || g.primaryId !== primaryId) return;
    const st0 = g.starts.get(primaryId)!;
    const dx = node.x() - st0.x;
    const dy = node.y() - st0.y;
    replaceElements((prev) => {
      let next = prev.map((row) => {
        if (!g.starts.has(row.id)) return row;
        if (row.type === "path" && g.pathFlats.has(row.id)) {
          const flat = g.pathFlats.get(row.id)!;
          const nf = flat.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
          const bb = bboxFromPathPoints(nf);
          return { ...row, path_points: nf, x: bb.minX, y: bb.minY, width: bb.w, height: bb.h };
        }
        if (row.type === "door") return row;
        const s0 = g.starts.get(row.id)!;
        return { ...row, x: s0.x + dx, y: s0.y + dy };
      });
      for (const z of prev) {
        if (g.starts.has(z.id) && z.type === "zone") next = relayoutAttachedDoors(next, z.id);
      }
      return next;
    });
    if (node.getClassName() === "Line") {
      node.position({ x: 0, y: 0 });
    }
    batchLayer();
  };

  const syncTransformToState = (id: string, node: Konva.Node) => {
    if (node.getClassName() === "Rect") {
      const maybeDoor = elements.find((e) => e.id === id);
      if (maybeDoor?.type === "door") {
        const r = node as Konva.Rect;
        const scaleX = r.scaleX();
        r.scaleX(1);
        r.scaleY(1);
        replaceElements((prev) => {
          const d = prev.find((e) => e.id === id);
          if (!d || d.type !== "door") return prev;
          let newAlong = Math.max(MIN_DOOR_ALONG, r.width() * scaleX);
          const p = parseWallAttach(d.wall_attachment);
          const zone = p ? prev.find((z) => z.id === p.zoneId && z.type === "zone") : null;
          if (p && zone) newAlong = Math.min(newAlong, doorAlongUpperBound(zone, p), MAX_DOOR_ALONG);
          return relayoutAllDoors(prev.map((e) => (e.id === id ? { ...e, width: newAlong } : e)));
        });
        transformUndoPrimedRef.current = false;
        return;
      }
    }

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
    replaceElements((prev) => {
      let next = prev.map((e) =>
        e.id === id
          ? {
              ...e,
              x,
              y,
              width,
              height,
              rotation,
            }
          : e,
      );
      const updated = next.find((e) => e.id === id);
      if (updated?.type === "zone") next = relayoutAttachedDoors(next, id);
      return next;
    });
    transformUndoPrimedRef.current = false;
  };

  useLayoutEffect(() => {
    if (!selectedSingleId) selectedNodeRef.current = null;
  }, [selectedSingleId]);

  useLayoutEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (designerMode === "publish") {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    if (linkingForTaskId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const sel = selectedSingleId ? elements.find((e) => e.id === selectedSingleId) : null;
    let n: Konva.Node | null = null;
    if (sel?.type === "door") n = doorInnerRefMap.current.get(selectedSingleId!) ?? null;
    else if (sel?.type === "zone" && !zonePolygonFlat(sel)) n = selectedNodeRef.current;
    if (n && selectedSingleId && tool === "select") {
      tr.nodes([n]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedSingleId, elements, tool, stageSize.w, stageSize.h, designerMode, linkingForTaskId, stageScale]);

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
    const glowW = Math.max(3.5, sw * 3.2);
    const sb = Math.max(6, 11 / stageScale);
    return snapGuides.map((g, i) =>
      g.kind === "v" ? (
        <Group key={`snapg-v-${i}-${g.x}`} listening={false}>
          <Line
            points={[g.x, minWY - pad, g.x, maxWY + pad]}
            stroke="rgba(56, 189, 248, 0.16)"
            strokeWidth={glowW}
            lineCap="round"
            listening={false}
          />
          <Line
            points={[g.x, minWY - pad, g.x, maxWY + pad]}
            stroke="rgba(186, 230, 253, 0.94)"
            strokeWidth={sw}
            dash={[6, 4]}
            lineCap="round"
            shadowColor="rgba(56, 189, 248, 0.5)"
            shadowBlur={sb}
            shadowOpacity={1}
            listening={false}
          />
        </Group>
      ) : (
        <Group key={`snapg-h-${i}-${g.y}`} listening={false}>
          <Line
            points={[minWX - pad, g.y, maxWX + pad, g.y]}
            stroke="rgba(56, 189, 248, 0.16)"
            strokeWidth={glowW}
            lineCap="round"
            listening={false}
          />
          <Line
            points={[minWX - pad, g.y, maxWX + pad, g.y]}
            stroke="rgba(186, 230, 253, 0.94)"
            strokeWidth={sw}
            dash={[6, 4]}
            lineCap="round"
            shadowColor="rgba(56, 189, 248, 0.5)"
            shadowBlur={sb}
            shadowOpacity={1}
            listening={false}
          />
        </Group>
      )
    );
  })();

  const updateSelectedField = (patch: Partial<BlueprintElement>) => {
    if (!selectedSingleId) return;
    commitElements((prev) => prev.map((el) => (el.id === selectedSingleId ? { ...el, ...patch } : el)));
  };

  const rotateSelection90Clockwise = useCallback(() => {
    if (!selectedSingleId) return;
    checkpointBlueprint();
    commitElements((prev) => {
      const row = prev.find((x) => x.id === selectedSingleId);
      if (!row || row.type === "door") return prev;
      if (row.type === "path" && row.path_points && row.path_points.length >= 6) {
        const flat = [...row.path_points];
        let sx = 0;
        let sy = 0;
        const n = flat.length / 2;
        for (let i = 0; i < flat.length; i += 2) {
          sx += flat[i]!;
          sy += flat[i + 1]!;
        }
        const cx = sx / n;
        const cy = sy / n;
        const rotated = rotatePathFlat90Cw(flat, cx, cy);
        const bb = bboxFromPathPoints(rotated);
        return relayoutAllDoors(
          prev.map((x) =>
            x.id === selectedSingleId
              ? { ...x, path_points: rotated, x: bb.minX, y: bb.minY, width: bb.w, height: bb.h }
              : x,
          ),
        );
      }
      if (row.type === "path") return prev;
      if (row.type === "zone" && row.path_points && row.path_points.length >= 6) {
        const flat = [...row.path_points];
        const { cx, cy } = polygonCentroidFlat(flat);
        const rotated = rotatePathFlat90Cw(flat, cx, cy);
        const bb = bboxFromPathPoints(rotated);
        return relayoutAllDoors(
          prev.map((x) =>
            x.id === selectedSingleId
              ? { ...x, path_points: rotated, x: bb.minX, y: bb.minY, width: bb.w, height: bb.h, rotation: 0 }
              : x,
          ),
        );
      }
      const r = (row.rotation ?? 0) + 90;
      const norm = ((r % 360) + 360) % 360;
      let next = prev.map((x) => (x.id === selectedSingleId ? { ...x, rotation: norm } : x));
      if (row.type === "zone") next = relayoutAttachedDoors(next, selectedSingleId);
      return relayoutAllDoors(next);
    });
    transformUndoPrimedRef.current = false;
    batchLayer();
  }, [selectedSingleId, commitElements, checkpointBlueprint, batchLayer]);

  return (
    <div className={`bp-shell${isPublish ? " bp-shell--publish" : ""}`}>
      <BlueprintToolRail
        tool={tool}
        onToolChange={(t) => {
          setTool(t);
          if (t !== "place-symbol") setSymbolPanelOpen(false);
        }}
        symbolPanelOpen={symbolPanelOpen}
        onToggleSymbolPanel={() => setSymbolPanelOpen((v) => !v)}
        disabled={!canEdit}
      />
      <motion.aside
        className={`bp-sidebar${isPublish ? " bp-sidebar--disabled" : ""}`}
        aria-label="Blueprint sidebar"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={bpTransition.med}
      >
        {standalone ? (
          <p className="bp-hint" style={{ marginBottom: 12 }}>
            Public playground: same editor as Pulse. <strong>Publish</strong> to export PNG/PDF. Saving to your org
            requires signing in on the{" "}
            <a href={pulseApp.login()} className="text-sky-600 underline dark:text-sky-400">
              Pulse app
            </a>
            .
          </p>
        ) : null}
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
        <BlueprintTasksPanel
          tasks={tasks}
          disabled={isPublish}
          selectedTaskId={selectedTaskId}
          onSelectTaskId={setSelectedTaskId}
          linkingForTaskId={linkingForTaskId}
          onLinkingForTaskId={setLinkingForTaskId}
          highlightStep={taskStepHighlight}
          onHighlightStep={setTaskStepHighlight}
          pinnedStep={taskStepPin}
          onPinnedStep={setTaskStepPin}
          emphasizedTaskIds={emphasizedTaskIds}
          onPatchTask={patchTask}
          onAddTask={() => {
            const id = crypto.randomUUID();
            updateBlueprint((bp) => ({
              ...bp,
              tasks: [
                ...bp.tasks,
                {
                  id,
                  title: "New task",
                  mode: "steps",
                  content: ["Step 1"],
                  linked_element_ids: [],
                },
              ],
            }));
            setSelectedTaskId(id);
          }}
          onDeleteTask={(id) => {
            updateBlueprint((bp) => ({ ...bp, tasks: bp.tasks.filter((t) => t.id !== id) }));
            setSelectedTaskId((cur) => (cur === id ? null : cur));
            setLinkingForTaskId((cur) => (cur === id ? null : cur));
            setTaskStepHighlight((h) => (h?.taskId === id ? null : h));
            setTaskStepPin((h) => (h?.taskId === id ? null : h));
          }}
        />
        <p className="bp-hint">
          Scroll to zoom (cursor-centered). Hold Space and drag or right-drag to pan. Esc clears selection and closes the
          symbol panel; arrow keys nudge selection (Shift for larger steps). Draw rooms on the grid. Door: click within{" "}
          {WALL_SNAP_PX}px of a room edge. Free draw: drag and release; the stroke is simplified (simplify-js) and smoothed with quadratic curves into a closed shape. Symbols:
          open the Symbols panel from the tool rail, pick a tile, then click the canvas (extensible via symbol_type).
        </p>
      </motion.aside>

      <div className="bp-workspace">
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
              disabled={isPublish || standalone}
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
            disabled={saving || isPublish || standalone}
            title={standalone ? "Sign in on Pulse to save blueprints to your organization" : undefined}
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
              setSymbolPanelOpen(false);
              setSelectedIds([]);
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
        {linkingForTaskId && canEdit ? (
          <div className="bp-task-link-banner" role="status">
            <span>Link mode: tap or click elements on the canvas to attach or detach. Press Esc or Done when finished.</span>
            <button type="button" className="bp-btn bp-btn--ghost" onClick={() => setLinkingForTaskId(null)}>
              Done
            </button>
          </div>
        ) : null}
        <div
          ref={hostRef}
          className={`bp-stage-host ${spaceDown || isPanning ? "is-panning" : ""}${isPublish ? " bp-stage-host--publish" : ""}${canEdit && !isPublish ? ` bp-stage-host--tool-${tool}` : ""}${isDraggingSelection && canEdit && !isPublish ? " is-dragging-selection" : ""}`}
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
                onMouseDown={(e) => {
                  if (!canEdit) return;
                  if (tool === "draw-room" && e.evt.button === 0) {
                    e.cancelBubble = true;
                    const st = e.target.getStage();
                    const w = getWorldFromStage(st);
                    if (w) startDraw(w.x, w.y);
                  } else if (tool === "select" && e.evt.button === 0 && !spaceDown) {
                    beginMarqueeSelect(e);
                  }
                }}
              />
              {elements
                .filter((el) => el.type === "zone")
                .map((el) => {
                  const polyPts = zonePolygonFlat(el);
                  const sel = selectedIds.includes(el.id);
                  const zGlow = canEdit && tool === "select" && !sel && hoverZoneId === el.id;
                  const tg = taskGlowIds.has(el.id);
                  const zoneFill = isPublish ? "rgba(248, 250, 252, 0.085)" : ZONE_FACE_FILL;
                  const zoneStroke = isPublish ? "rgba(241, 245, 249, 0.94)" : ZONE_OUTLINE;
                  const sw = pubLine(Math.max(0.75, 1.22 / stageScale));
                  if (polyPts) {
                    const bb = bboxFromPathPoints(polyPts);
                    const labelSize = pubFs(Math.min(11, Math.max(9, Math.min(bb.w, bb.h) / 7)));
                    return (
                      <Group key={el.id}>
                        <Line
                          points={polyPts}
                          closed
                          tension={0}
                          fill={zoneFill}
                          stroke={tg ? "rgba(56, 189, 248, 0.75)" : mergePair && (mergePair.a.id === el.id || mergePair.b.id === el.id) ? "rgba(250, 204, 21, 0.75)" : zoneStroke}
                          strokeWidth={tg ? sw * 1.35 : sw}
                          lineJoin="round"
                          shadowColor={
                            tg
                              ? "rgba(56, 189, 248, 0.55)"
                              : sel
                                ? "rgba(59, 130, 246, 0.48)"
                                : zGlow
                                  ? "rgba(96, 165, 250, 0.4)"
                                  : "rgba(0, 0, 0, 0.2)"
                          }
                          shadowBlur={tg ? 24 : sel ? 20 : zGlow ? 16 : 6}
                          shadowOpacity={tg ? 0.45 : sel ? 0.38 : zGlow ? 0.24 : 0.12}
                          hitStrokeWidth={ZONE_EDGE_HIT_PX / Math.max(0.35, stageScale)}
                          listening={canEdit && tool === "select"}
                          draggable={canEdit && tool === "select"}
                          onMouseEnter={() => {
                            if (canEdit && tool === "select") setCanvasHoverElementId(el.id);
                            if (canEdit && tool === "select" && !sel) setHoverZoneId(el.id);
                          }}
                          onMouseLeave={() => {
                            setCanvasHoverElementId((z) => (z === el.id ? null : z));
                            setHoverZoneId((z) => (z === el.id ? null : z));
                          }}
                          onClick={(e) => canEdit && handleSelectElementClick(e, el.id)}
                          onTap={(e) => canEdit && handleSelectElementClick(e, el.id)}
                          onDragStart={(e) => {
                            if (canEdit && tool === "select") {
                              setIsDraggingSelection(true);
                              checkpointBlueprint();
                            }
                            initMultiDragIfNeeded(el.id);
                            if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                          }}
                          onDragMove={() => batchLayer()}
                          onDragEnd={(e) => {
                            setIsDraggingSelection(false);
                            const g = groupDragRef.current;
                            const wasMulti = g && g.primaryId === el.id;
                            if (wasMulti) groupDragRef.current = null;
                            const node = e.target as Konva.Line;
                            runDragScale(node, 1);
                            if (wasMulti) {
                              replaceElements((prev) => relayoutAllDoors(prev));
                              return;
                            }
                            const ox = node.x();
                            const oy = node.y();
                            if (ox === 0 && oy === 0) return;
                            node.x(0);
                            node.y(0);
                            const flat = polyPts.map((v, i) => (i % 2 === 0 ? v + ox : v + oy));
                            const nbb = bboxFromPathPoints(flat);
                            replaceElements((prev) =>
                              relayoutAttachedDoors(
                                prev.map((row) =>
                                  row.id === el.id
                                    ? { ...row, path_points: flat, x: nbb.minX, y: nbb.minY, width: nbb.w, height: nbb.h }
                                    : row,
                                ),
                                el.id,
                              ),
                            );
                          }}
                        />
                        <Text
                          text={(el.name ?? "ROOM").toUpperCase()}
                          x={bb.minX}
                          y={bb.minY}
                          width={bb.w}
                          height={bb.h}
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
                  }
                  const w = el.width ?? 120;
                  const h = el.height ?? 80;
                  const rot = el.rotation ?? 0;
                  const { dx, dy } = wallDropOffset(rot);
                  const ins = Math.max(0.6, pubLine(1.05 / stageScale));
                  const labelSize = pubFs(Math.min(11, Math.max(9, Math.min(w, h) / 7)));
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
                          if (
                            el.id === selectedSingleId &&
                            tool === "select" &&
                            canEdit &&
                            selected?.type === "zone" &&
                            !zonePolygonFlat(el)
                          ) {
                            selectedNodeRef.current = node;
                          }
                        }}
                        x={el.x}
                        y={el.y}
                        width={w}
                        height={h}
                        rotation={rot}
                        cornerRadius={ZONE_RADIUS}
                        fill={zoneFill}
                        stroke={tg ? "rgba(56, 189, 248, 0.75)" : zoneStroke}
                        shadowColor={
                          tg
                            ? "rgba(56, 189, 248, 0.55)"
                            : sel
                              ? "rgba(59, 130, 246, 0.48)"
                              : zGlow
                                ? "rgba(96, 165, 250, 0.4)"
                                : "rgba(0, 0, 0, 0.2)"
                        }
                        shadowBlur={tg ? 24 : sel ? 20 : zGlow ? 16 : 6}
                        shadowOpacity={tg ? 0.45 : sel ? 0.38 : zGlow ? 0.24 : 0.12}
                        strokeWidth={tg ? sw * 1.35 : sw}
                        shadowOffset={{ x: 0, y: sel ? 0 : 2 }}
                        hitStrokeWidth={ZONE_EDGE_HIT_PX / Math.max(0.35, stageScale)}
                        listening={canEdit && tool === "select"}
                        draggable={canEdit && tool === "select"}
                        onMouseEnter={(e) => {
                          if (canEdit && tool === "select") setCanvasHoverElementId(el.id);
                          if (canEdit && tool === "select" && !sel) setHoverZoneId(el.id);
                          const t = e.target as unknown as { getClassName?: () => string; stroke?: (s: string) => void };
                          if (canEdit && tool === "select" && !sel && t.getClassName?.() === "Rect") t.stroke?.(ZONE_OUTLINE_HOVER);
                        }}
                        onMouseLeave={(e) => {
                          setCanvasHoverElementId((z) => (z === el.id ? null : z));
                          setHoverZoneId((z) => (z === el.id ? null : z));
                          const t = e.target as unknown as { getClassName?: () => string; stroke?: (s: string) => void };
                          if (t.getClassName?.() === "Rect") t.stroke?.(zoneStroke);
                        }}
                        onClick={(e) => canEdit && handleSelectElementClick(e, el.id)}
                        onTap={(e) => canEdit && handleSelectElementClick(e, el.id)}
                        onDragStart={(e) => {
                          if (canEdit && tool === "select") {
                            setIsDraggingSelection(true);
                            checkpointBlueprint();
                          }
                          initMultiDragIfNeeded(el.id);
                          if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                        }}
                        onDragMove={(e) => {
                          if (!canEdit || tool !== "select") return;
                          const node = e.target;
                          const g = groupDragRef.current;
                          if (g && g.primaryId === el.id && selectedIds.length > 1) {
                            setSnapGuides([]);
                            flushMultiDragMove(el.id, node);
                            return;
                          }
                          const { x, y, guides } = snapZoneDrag(el, node.x(), node.y(), elements);
                          node.x(x);
                          node.y(y);
                          setSnapGuides(guides);
                          batchLayer();
                        }}
                        onDragEnd={(e) => {
                          setIsDraggingSelection(false);
                          const g = groupDragRef.current;
                          const wasMulti = g && g.primaryId === el.id;
                          if (wasMulti) groupDragRef.current = null;
                          const node = e.target;
                          runDragScale(node, 1);
                          setSnapGuides([]);
                          if (wasMulti) {
                            replaceElements((prev) => relayoutAllDoors(prev));
                            return;
                          }
                          const nx = node.x();
                          const ny = node.y();
                          replaceElements((prev) => {
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
                  const sel = selectedIds.includes(el.id);
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
                  const tg = taskGlowIds.has(el.id);
                  return (
                    <Group
                      key={el.id}
                      x={el.x}
                      y={el.y}
                      rotation={rot}
                      scaleX={tg ? 1.08 : 1}
                      scaleY={tg ? 1.08 : 1}
                      listening={canEdit && tool === "select"}
                      onMouseEnter={() => {
                        if (canEdit && tool === "select") setCanvasHoverElementId(el.id);
                      }}
                      onMouseLeave={() => setCanvasHoverElementId((z) => (z === el.id ? null : z))}
                      onClick={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onTap={(e) => canEdit && handleSelectElementClick(e, el.id)}
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
                        ref={(node) => {
                          if (node) doorInnerRefMap.current.set(el.id, node);
                          else doorInnerRefMap.current.delete(el.id);
                        }}
                        x={-along / 2}
                        y={-depth / 2}
                        width={along}
                        height={depth}
                        cornerRadius={2}
                        fill={doorFill}
                        stroke={tg ? "rgba(56, 189, 248, 0.85)" : doorStroke}
                        strokeWidth={tg ? sw * 1.4 : sw}
                        shadowColor={tg ? "rgba(56, 189, 248, 0.45)" : undefined}
                        shadowBlur={tg ? 14 : 0}
                        shadowOpacity={tg ? 0.9 : 0}
                        listening={canEdit && tool === "select"}
                        onTransformEnd={(e) => {
                          setSnapGuides([]);
                          syncTransformToState(el.id, e.target);
                        }}
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
                  const sel = selectedIds.includes(el.id);
                  const sStroke = pubLine(Math.max(0.65, 0.9 / stageScale));
                  const sGlow = canEdit && tool === "select" && !sel && hoverSymbolId === el.id;
                  const stg = taskGlowIds.has(el.id);
                  const symLabelFs = pubFs(Math.min(9, w / 5));
                  const labelBand = Math.ceil(symLabelFs + SYMBOL_LABEL_BAND_GAP);
                  const iconSlotH = Math.max(4, h - labelBand);
                  return (
                    <Group
                      key={el.id}
                      x={el.x}
                      y={el.y}
                      rotation={el.rotation ?? 0}
                      scaleX={stg ? 1.06 : 1}
                      scaleY={stg ? 1.06 : 1}
                      listening={canEdit && tool === "select"}
                      draggable={canEdit && tool === "select"}
                      shadowColor={
                        isPublish
                          ? "rgba(0, 0, 0, 0.25)"
                          : stg
                            ? "rgba(56, 189, 248, 0.5)"
                            : sel
                              ? "rgba(59, 130, 246, 0.35)"
                              : sGlow
                                ? "rgba(96, 165, 250, 0.38)"
                                : "rgba(0, 0, 0, 0.45)"
                      }
                      shadowBlur={isPublish ? 6 : stg ? 20 : sel ? 16 : sGlow ? 14 : 8}
                      shadowOpacity={isPublish ? 0.18 : 0.28}
                      shadowOffset={{ x: 0, y: 3 }}
                      onClick={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onTap={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onDragStart={(e) => {
                        if (canEdit && tool === "select") {
                          setIsDraggingSelection(true);
                          checkpointBlueprint();
                        }
                        initMultiDragIfNeeded(el.id);
                        if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragMove={(e) => {
                        if (!canEdit || tool !== "select") return;
                        const node = e.target;
                        if (groupDragRef.current && groupDragRef.current.primaryId === el.id && selectedIds.length > 1) {
                          flushMultiDragMove(el.id, node);
                        }
                      }}
                      onDragEnd={(e) => {
                        setIsDraggingSelection(false);
                        const g = groupDragRef.current;
                        const wasMulti = g && g.primaryId === el.id;
                        if (wasMulti) groupDragRef.current = null;
                        const node = e.target;
                        runDragScale(node, 1);
                        if (wasMulti) {
                          replaceElements((prev) => relayoutAllDoors(prev));
                          return;
                        }
                        const nx = node.x();
                        const ny = node.y();
                        replaceElements((prev) =>
                          prev.map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x)),
                        );
                      }}
                      onMouseEnter={() => {
                        if (canEdit && tool === "select") setCanvasHoverElementId(el.id);
                        if (canEdit && tool === "select" && !sel) setHoverSymbolId(el.id);
                      }}
                      onMouseLeave={() => {
                        setCanvasHoverElementId((z) => (z === el.id ? null : z));
                        setHoverSymbolId((z) => (z === el.id ? null : z));
                      }}
                      opacity={0.98}
                    >
                      <Rect
                        width={w}
                        height={h}
                        cornerRadius={8}
                        fill={isPublish ? "rgba(248, 250, 252, 0.1)" : "rgba(15, 23, 42, 0.14)"}
                        stroke={
                          stg
                            ? "rgba(56, 189, 248, 0.75)"
                            : sel
                              ? "rgba(96, 165, 250, 0.55)"
                              : sGlow
                                ? "rgba(203, 213, 245, 0.32)"
                                : isPublish
                                  ? "rgba(226, 232, 240, 0.42)"
                                  : "rgba(203, 213, 245, 0.12)"
                        }
                        strokeWidth={stg ? sStroke * 1.35 : sStroke}
                        listening={false}
                      />
                      <Group
                        x={w / 2}
                        y={iconSlotH / 2 - SYMBOL_ICON_Y_NUDGE}
                        scaleX={symScale}
                        scaleY={symScale}
                        listening={false}
                      >
                        <SymbolGlyph symbolType={st} />
                      </Group>
                      <Text
                        text={(el.name ?? st).toUpperCase()}
                        x={0}
                        y={iconSlotH}
                        width={w}
                        height={labelBand}
                        align="center"
                        verticalAlign="middle"
                        fill={isPublish ? "#f1f5f9" : "#cbd5f5"}
                        opacity={isPublish ? 0.95 : 0.82}
                        fontSize={symLabelFs}
                        fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
                        listening={false}
                        wrap="none"
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
                  const sel = selectedIds.includes(el.id);
                  const dStroke = pubLine(Math.max(0.65, 0.92 / stageScale));
                  const dGlow = canEdit && tool === "select" && !sel && hoverDeviceId === el.id;
                  const dtg = taskGlowIds.has(el.id);
                  const pulse = !isPublish && (st === "alarm" || st === "warning");
                  return (
                    <Group
                      key={el.id}
                      ref={(node) => {
                        if (
                          el.id === selectedSingleId &&
                          tool === "select" &&
                          canEdit &&
                          selected?.type === "device"
                        ) {
                          selectedNodeRef.current = node;
                        }
                      }}
                      x={el.x}
                      y={el.y}
                      rotation={el.rotation ?? 0}
                      scaleX={dtg ? 1.06 : 1}
                      scaleY={dtg ? 1.06 : 1}
                      listening={canEdit && tool === "select"}
                      draggable={canEdit && tool === "select"}
                      shadowColor={
                        isPublish
                          ? "rgba(0, 0, 0, 0.35)"
                          : dtg
                            ? "rgba(56, 189, 248, 0.52)"
                            : sel
                              ? "rgba(59, 130, 246, 0.42)"
                              : dGlow
                                ? "rgba(96, 165, 250, 0.4)"
                                : "rgba(0, 0, 0, 0.55)"
                      }
                      shadowBlur={isPublish ? 8 : dtg ? 24 : sel ? 21 : dGlow ? 16 : 11}
                      shadowOpacity={isPublish ? 0.16 : 0.24}
                      shadowOffset={{ x: 0, y: 5 }}
                      onClick={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onTap={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onDragStart={(e) => {
                        if (canEdit && tool === "select") {
                          setIsDraggingSelection(true);
                          checkpointBlueprint();
                        }
                        initMultiDragIfNeeded(el.id);
                        if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragMove={(e) => {
                        if (!canEdit || tool !== "select") return;
                        const node = e.target;
                        if (groupDragRef.current && groupDragRef.current.primaryId === el.id && selectedIds.length > 1) {
                          flushMultiDragMove(el.id, node);
                        }
                      }}
                      onDragEnd={(e) => {
                        setIsDraggingSelection(false);
                        const g = groupDragRef.current;
                        const wasMulti = g && g.primaryId === el.id;
                        if (wasMulti) groupDragRef.current = null;
                        const node = e.target;
                        runDragScale(node, 1);
                        if (wasMulti) {
                          replaceElements((prev) => relayoutAllDoors(prev));
                          return;
                        }
                        const nx = node.x();
                        const ny = node.y();
                        replaceElements((prev) =>
                          prev.map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x)),
                        );
                      }}
                      onTransformEnd={(e) => syncTransformToState(el.id, e.target)}
                      onMouseEnter={(e) => {
                        if (canEdit && tool === "select") setCanvasHoverElementId(el.id);
                        if (canEdit && tool === "select" && !sel) setHoverDeviceId(el.id);
                        if (!canEdit || tool !== "select" || sel) return;
                        e.currentTarget.opacity(1);
                      }}
                      onMouseLeave={(e) => {
                        setCanvasHoverElementId((z) => (z === el.id ? null : z));
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
                          dtg
                            ? "rgba(56, 189, 248, 0.82)"
                            : sel
                              ? "rgba(96, 165, 250, 0.45)"
                              : dGlow
                                ? "rgba(203, 213, 245, 0.28)"
                                : isPublish
                                  ? "rgba(226, 232, 240, 0.38)"
                                  : "rgba(203, 213, 245, 0.16)"
                        }
                        strokeWidth={dtg ? dStroke * 1.35 : dStroke}
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
                  const sel = selectedIds.includes(el.id);
                  const sw = pubLine(Math.max(0.65, 1 / stageScale));
                  const pathFill = isPublish ? "rgba(56, 189, 248, 0.14)" : "rgba(56, 189, 248, 0.08)";
                  const ptg = taskGlowIds.has(el.id);
                  const pathStroke = ptg
                    ? "rgba(56, 189, 248, 0.92)"
                    : sel
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
                      strokeWidth={ptg ? sw * 1.45 : sw}
                      lineCap="round"
                      lineJoin="round"
                      shadowColor={ptg ? "rgba(56, 189, 248, 0.45)" : undefined}
                      shadowBlur={ptg ? 12 : 0}
                      shadowOpacity={ptg ? 1 : 0}
                      listening={canEdit && tool === "select"}
                      draggable={canEdit && tool === "select"}
                      hitStrokeWidth={Math.max(16, 14 / stageScale)}
                      onMouseEnter={() => {
                        if (canEdit && tool === "select") setCanvasHoverElementId(el.id);
                      }}
                      onMouseLeave={() => setCanvasHoverElementId((z) => (z === el.id ? null : z))}
                      onClick={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onTap={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onDragStart={(e) => {
                        if (canEdit && tool === "select") {
                          setIsDraggingSelection(true);
                          checkpointBlueprint();
                        }
                        initMultiDragIfNeeded(el.id);
                        if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragMove={(e) => {
                        if (!canEdit || tool !== "select") return;
                        const node = e.target;
                        if (groupDragRef.current && groupDragRef.current.primaryId === el.id && selectedIds.length > 1) {
                          flushMultiDragMove(el.id, node);
                        }
                      }}
                      onDragEnd={(e) => {
                        setIsDraggingSelection(false);
                        const g = groupDragRef.current;
                        const wasMulti = g && g.primaryId === el.id;
                        if (wasMulti) groupDragRef.current = null;
                        const node = e.target as Konva.Line;
                        runDragScale(node, 1);
                        if (wasMulti) {
                          node.position({ x: 0, y: 0 });
                          replaceElements((prev) => relayoutAllDoors(prev));
                          return;
                        }
                        const ox = node.x();
                        const oy = node.y();
                        node.position({ x: 0, y: 0 });
                        replaceElements((prev) =>
                          prev.map((row) => {
                            if (row.id !== el.id || row.type !== "path" || !row.path_points || row.path_points.length < 6) {
                              return row;
                            }
                            const flat = row.path_points.map((v, i) => (i % 2 === 0 ? v + ox : v + oy));
                            const bb = bboxFromPathPoints(flat);
                            return {
                              ...row,
                              path_points: flat,
                              x: bb.minX,
                              y: bb.minY,
                              width: bb.w,
                              height: bb.h,
                            };
                          }),
                        );
                      }}
                    />
                  );
                })}
              {tool === "select" && marqueeBox ? (
                <Rect
                  x={marqueeBox.L}
                  y={marqueeBox.T}
                  width={Math.max(0.01, marqueeBox.R - marqueeBox.L)}
                  height={Math.max(0.01, marqueeBox.B - marqueeBox.T)}
                  fill="rgba(59, 130, 246, 0.12)"
                  stroke="rgba(147, 197, 253, 0.72)"
                  strokeWidth={Math.max(1, 1.5 / stageScale)}
                  dash={[6, 4]}
                  shadowColor="rgba(59, 130, 246, 0.35)"
                  shadowBlur={Math.max(4, 8 / stageScale)}
                  shadowOpacity={0.85}
                  listening={false}
                />
              ) : null}
              {tool === "select" && selectionBounds ? (
                <Rect
                  x={selectionBounds.L}
                  y={selectionBounds.T}
                  width={Math.max(0.01, selectionBounds.R - selectionBounds.L)}
                  height={Math.max(0.01, selectionBounds.B - selectionBounds.T)}
                  fill="transparent"
                  stroke="rgba(125, 211, 252, 0.82)"
                  strokeWidth={Math.max(1.25, 2 / stageScale)}
                  dash={[8, 5]}
                  shadowColor="rgba(56, 189, 248, 0.4)"
                  shadowBlur={Math.max(5, 10 / stageScale)}
                  shadowOpacity={1}
                  listening={false}
                />
              ) : null}
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
                rotateEnabled={selected?.type !== "door"}
                enabledAnchors={selected?.type === "door" ? ["middle-left", "middle-right"] : undefined}
                borderStroke={
                  snapGuides.length > 0 ? "rgba(147, 197, 253, 0.88)" : "rgba(96, 165, 250, 0.58)"
                }
                borderDash={[5, 4]}
                anchorStroke="rgba(203, 213, 245, 0.55)"
                anchorFill="rgba(15, 23, 42, 0.95)"
                anchorSize={TRANSFORMER_ANCHOR_PX}
                padding={TRANSFORMER_PADDING_PX}
                boundBoxFunc={(oldBox, newBox) => {
                  if (tool !== "select") return newBox;
                  const sid = selectedSingleId;
                  if (!sid) return newBox;
                  const sel = elements.find((u) => u.id === sid);
                  if (sel?.type === "door") {
                    const p = parseWallAttach(sel.wall_attachment);
                    const z = p ? elements.find((u) => u.id === p.zoneId && u.type === "zone") : null;
                    const maxW = p && z ? Math.min(MAX_DOOR_ALONG, doorAlongUpperBound(z, p)) : MAX_DOOR_ALONG;
                    const w = Math.max(MIN_DOOR_ALONG, Math.min(maxW, newBox.width));
                    return {
                      ...newBox,
                      width: w,
                      height: oldBox.height,
                      x: oldBox.x,
                      y: oldBox.y,
                      rotation: oldBox.rotation ?? 0,
                    };
                  }
                  if (newBox.width < MIN_ZONE || newBox.height < MIN_ZONE) return oldBox;
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
                  if (!tr || tool !== "select" || !selectedSingleId) {
                    setSnapGuides([]);
                    return;
                  }
                  if (!transformUndoPrimedRef.current) {
                    checkpointBlueprint();
                    transformUndoPrimedRef.current = true;
                  }
                  const sel = elements.find((u) => u.id === selectedSingleId);
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
                    selectedSingleId,
                  );
                  setSnapGuides(guides);
                  batchLayer();
                }}
                onTransformEnd={() => {
                  setSnapGuides([]);
                  transformUndoPrimedRef.current = false;
                }}
              />
            </Layer>
          </Stage>
        </div>
      </motion.div>
      <BlueprintSymbolPanel
        open={symbolPanelOpen && canEdit}
        onClose={() => setSymbolPanelOpen(false)}
        activeSymbolId={placeSymbolKind}
        onSelectSymbol={(id) => {
          setPlaceSymbolKind(id);
          setTool("place-symbol");
        }}
        disabled={!canEdit}
      />
      </div>

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
          {selectedIds.length > 1 ? (
            <motion.div
              key="props-multi"
              className="bp-props-body"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={bpTransition.med}
            >
              <p className="bp-hint">
                {selectedIds.length} elements selected. Drag one of the highlighted items to move the group together.
                Shift+click or drag a box on the canvas to add to the selection. Delete / Backspace removes all; arrow
                keys nudge; Esc clears.
              </p>
              {mergePair && canEdit ? (
                <div className="bp-field">
                  <button type="button" className="bp-btn" onClick={mergeSelectedRooms}>
                    Merge rooms (remove shared wall)
                  </button>
                  <p className="bp-hint" style={{ marginTop: 8 }}>
                    Combines two axis-aligned rectangles into one room (L-shapes supported). Doors on either room are
                    removed; re-place after merging.
                  </p>
                </div>
              ) : selectedIds.length === 2 && canEdit ? (
                <p className="bp-hint">Select two plain (non-polygon) unrotated rooms that share an edge to merge.</p>
              ) : null}
            </motion.div>
          ) : !selected ? (
            <motion.p
              key="props-empty"
              className="bp-hint"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={bpTransition.med}
            >
              Select a room, device, symbol, or shape, or use tools on the canvas. Shift+click for multi-select, or
              drag on empty space to box-select.
            </motion.p>
          ) : (
            <motion.div
              key={selected.id}
              className="bp-props-body"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={bpTransition.med}
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
                <div className="bp-field-row">
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
                <div className="bp-field-row">
                  <input
                    type="number"
                    value={Math.round(selected.width ?? 0)}
                    readOnly={selected.type === "path"}
                    title={selected.type === "path" ? "BBox width (geometry is path_points)" : undefined}
                    onChange={(e) => {
                      const width = Math.max(12, Number(e.target.value) || 0);
                      if (selected.type === "path") return;
                      if (selected.type === "door") {
                        commitElements((p) => {
                          const next = p.map((x) => (x.id === selectedSingleId ? { ...x, width } : x));
                          return next.map((x) =>
                            x.id === selectedSingleId && x.type === "door"
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
                        commitElements((p) => {
                          const next = p.map((x) => (x.id === selectedSingleId ? { ...x, height } : x));
                          return next.map((x) =>
                            x.id === selectedSingleId && x.type === "door"
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
              <div className="bp-field">
                <label>Rotation</label>
                <div className="bp-field-row bp-field-row--rotation">
                  <span
                    className="bp-rotate-readout"
                    title={
                      selected.type === "path"
                        ? "Freehand shapes rotate in 90° steps around their centroid (not the rotation field)."
                        : undefined
                    }
                  >
                    {selected.type === "path"
                      ? "—"
                      : `${(((selected.rotation ?? 0) % 360) + 360) % 360}°`}
                  </span>
                  <button
                    type="button"
                    className="bp-rotate-btn"
                    disabled={!canEdit || selected.type === "door"}
                    title={
                      selected.type === "door"
                        ? "Doors follow walls; rotate the room or adjust the wall attachment instead."
                        : "Rotate 90° clockwise"
                    }
                    onClick={rotateSelection90Clockwise}
                  >
                    Rotate 90°
                  </button>
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
