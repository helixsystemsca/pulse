"use client";

import { animate, AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type Konva from "konva";
import { Circle, Ellipse, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { apiFetch, isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { pulseApp } from "@/lib/pulse-app";
import { canAccessPulseTenantApis, readSession } from "@/lib/pulse-session";
import { useModuleSettings } from "@/providers/ModuleSettingsProvider";
import { ModuleSettingsGear } from "@/components/module-settings/ModuleSettingsGear";
import { emitOnboardingMaybeUpdated } from "@/lib/onboarding-events";
import { freehandOptionsFromSlider, processFreehandPath } from "@/lib/blueprint-freehand-path";
import { flattenPenDraftToClosedPath, type PenDraftAnchor } from "@/lib/blueprint-pen-path";
import { mergeClosedShapesUnion } from "@/lib/blueprint-shape-merge";
import { mergeZonesUnion } from "@/lib/blueprint-zone-union";
import {
  blueprintConnectionPairKey,
  blueprintConnectEndpointIdsInOrder,
  buildOrthogonalConnectionPath,
  existingConnectionPairKeys,
  isBlueprintConnectEndpoint,
  makeConnectionElement,
} from "@/lib/blueprint-connect-routing";
import {
  blueprintIdsEligibleToFormGroup,
  buildBlueprintChildToGroupMap,
  canonicalizeBlueprintSelectionIds,
  computeBlueprintGroupBounds,
  expandBlueprintSelectionForDeletion,
  expandBlueprintSelectionToEditableIds,
  isBlueprintElementEffectivelyLocked,
  resolveBlueprintGroupDragMembers,
  resolveBlueprintHitToSelectionId,
  syncBlueprintGroupBounds,
} from "@/lib/blueprint-groups";
import {
  blueprintPaintZIndices,
  parseApiBlueprintLayers,
  unionBlueprintElementsBounds,
} from "@/lib/blueprint-layout";
import { bpDuration, bpEase, bpTransition } from "@/lib/motion-presets";
import type {
  BlueprintDesignerTool,
  BlueprintElement,
  BlueprintLayer,
  ConnectionStyle,
  TaskOverlay,
} from "./blueprint-types";
export type {
  BlueprintElement,
  BlueprintLayer,
  BlueprintState,
  BlueprintHistoryState,
  ConnectionStyle,
  TaskOverlay,
} from "./blueprint-types";
import { BlueprintSymbolPanel } from "./BlueprintSymbolPanel";
import { BlueprintLayersPanel } from "./BlueprintLayersPanel";
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
  layers?: unknown;
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
/** Wall segments can be long (garage / bay doors); still clamped per-wall in `doorAlongUpperBound`. */
const MAX_DOOR_ALONG = 8000;
/** Canvas units ≈ plan scale: 32 px per meter (grid-friendly). */
const BP_PX_PER_M = 32;
/** Larger = transformer activates before touching the stroke. */
const ZONE_EDGE_HIT_PX = 22;
const TRANSFORMER_ANCHOR_PX = 14;
const TRANSFORMER_PADDING_PX = 12;
/** Max distance from click to zone edge to place a door (world px) */
const WALL_SNAP_PX = 26;
/** Match blueprint canvas background (--bp-bg) for wall “cut” overlay */
const CANVAS_BG_CUT = "#354766";

/** Free-draw: min distance between raw samples (world px) */
const FREE_DRAW_SAMPLE_DIST = 1.1;
/** Konva Line tension — 0 because `path_points` are flattened polyline (simplify-js + Catmull–Rom → cubic Bézier). */
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
  enableSnap = true,
): { x: number; y: number; guides: SnapGuide[] } {
  if (!enableSnap) return { x: nx, y: ny, guides: [] };
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
  enableSnap = true,
): { x: number; y: number; width: number; height: number } {
  if (!enableSnap) return { x: box.x, y: box.y, width: box.width, height: box.height };
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
  enableSnap = true,
): SnapGuide[] {
  if (!enableSnap) return [];
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

const POLY_CLOSE_PX = 14;
const PEN_DRAG_CURVE_PX = 8;
const POLY_HANDLE_R = 7;
const ANNOT_RECT_FILL = "rgba(148, 197, 255, 0.06)";
const ANNOT_RECT_STROKE = "rgba(148, 163, 184, 0.42)";
const ANNOT_ELLIPSE_FILL = "rgba(56, 189, 248, 0.07)";
const ANNOT_ELLIPSE_STROKE = "rgba(125, 211, 252, 0.45)";
const ANNOT_POLY_FILL = "rgba(167, 139, 250, 0.08)";
const ANNOT_POLY_STROKE = "rgba(196, 181, 253, 0.52)";

function clampRectCornerRadius(w: number, h: number, r: number): number {
  const m = Math.min(w, h) / 2;
  return Math.max(0, Math.min(r, m));
}

/** World-space offset for Shift+drag duplicates so the copy is visible from the original. */
const SHIFT_DUP_NUDGE = 10;

/** Axis-aligned world bounds for marquee / selection union. */
function elementWorldAabb(el: BlueprintElement): { L: number; R: number; T: number; B: number } | null {
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
      L = Math.min(L, pts[i]);
      R = Math.max(R, pts[i]);
      T = Math.min(T, pts[i + 1]);
      B = Math.max(B, pts[i + 1]);
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
  if (el.type === "zone") return zoneAabb(el);
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
    layer_id: e.layer_id?.trim() || undefined,
  };
}

function toApiPayload(elements: BlueprintElement[], layers: BlueprintLayer[]) {
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

/** Deep-enough clone for Shift+drag duplicate (new id, nudged geometry, doors lose wall attachment). */
function cloneBlueprintElementForShiftDup(el: BlueprintElement, dx: number, dy: number): BlueprintElement {
  const id = crypto.randomUUID();
  if (el.type === "door") {
    const { wall_attachment: _wa, ...rest } = el;
    return { ...rest, id, x: el.x + dx, y: el.y + dy };
  }
  const base: BlueprintElement = {
    ...el,
    id,
    path_points: el.path_points ? [...el.path_points] : undefined,
    symbol_tags: el.symbol_tags ? [...el.symbol_tags] : undefined,
  };
  if ((el.type === "zone" || el.type === "path" || el.type === "polygon") && el.path_points && el.path_points.length >= 6) {
    const flat = el.path_points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
    const bb = bboxFromPathPoints(flat);
    return { ...base, path_points: flat, x: bb.minX, y: bb.minY, width: bb.w, height: bb.h };
  }
  if (el.type === "connection" && el.path_points && el.path_points.length >= 4) {
    const flat = el.path_points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
    const bb = bboxFromPathPoints(flat);
    return { ...base, path_points: flat, x: bb.minX, y: bb.minY, width: bb.w, height: bb.h };
  }
  return { ...base, x: el.x + dx, y: el.y + dy };
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
  /**
   * Pulse full-screen shell: drop outer card padding and lift `max-height` so the stage uses the modal viewport.
   */
  fullscreen?: boolean;
};

export function BlueprintDesigner({ standalone = false, fullscreen = false }: BlueprintDesignerProps) {
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
  const layers = blueprint.layers;

  const activePaintLayerIdRef = useRef<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  useEffect(() => {
    if (layers.length === 0) {
      setActiveLayerId(null);
      activePaintLayerIdRef.current = null;
      return;
    }
    setActiveLayerId((cur) => (cur && layers.some((l) => l.id === cur) ? cur : layers[0]!.id));
  }, [layers]);

  useEffect(() => {
    activePaintLayerIdRef.current = activeLayerId ?? layers[0]?.id ?? null;
  }, [activeLayerId, layers]);

  const elementZ = useMemo(() => blueprintPaintZIndices(elements, layers), [elements, layers]);
  const ez = (elementId: string) => {
    const z = elementZ.get(elementId);
    return z === undefined ? {} : { zIndex: z };
  };

  const layerIdForNewGeometry = useCallback(() => {
    const id = activePaintLayerIdRef.current ?? layers[0]?.id;
    return id ? { layer_id: id } : {};
  }, [layers]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marqueeBox, setMarqueeBox] = useState<{ L: number; R: number; T: number; B: number } | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const toolRef = useRef<Tool>(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  const [placeKind, setPlaceKind] = useState<DeviceKind>("generic");
  const [placeSymbolKind, setPlaceSymbolKind] = useState<SymbolLibraryId>("tree");
  const [symbolPanelOpen, setSymbolPanelOpen] = useState(false);
  /** Raw stroke + element id for post-draw smoothness (slider 0–100). */
  const [freehandTune, setFreehandTune] = useState<{ id: string; raw: number[] } | null>(null);
  const [freehandSlider, setFreehandSlider] = useState(52);
  const [doorWidthUnit, setDoorWidthUnit] = useState<"ft" | "m">("ft");
  const [connectStyle, setConnectStyle] = useState<ConnectionStyle>("electrical");
  const connectStyleRef = useRef<ConnectionStyle>("electrical");
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [blueprintName, setBlueprintName] = useState("Untitled blueprint");
  const [list, setList] = useState<BlueprintSummary[]>([]);
  const [stageSize, setStageSize] = useState({ w: 800, h: 520 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  /** Bumped when switching blueprints / new file so the canvas refits without resetting on every edit. */
  const [viewLayoutEpoch, setViewLayoutEpoch] = useState(0);
  const userTouchedPanZoomRef = useRef(false);
  const prevFitRef = useRef<{ epoch: number; w: number; h: number }>({ epoch: -1, w: 0, h: 0 });
  const [drawDraft, setDrawDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Shown after a successful cloud save (where the blueprint is stored). */
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [designerMode, setDesignerMode] = useState<"edit" | "publish">("edit");
  /** Full-viewport editor shell (fixed overlay); canvas uses maximum vertical space. */
  const [immersiveOpen, setImmersiveOpen] = useState(false);

  useEffect(() => {
    if (!immersiveOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImmersiveOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [immersiveOpen]);

  const openDesignerInNewTab = useCallback(() => {
    if (typeof window === "undefined") return;
    const path = standalone ? "/blueprint" : "/zones-devices/blueprint";
    window.open(`${window.location.origin}${path}`, "_blank", "noopener,noreferrer");
  }, [standalone]);
  /** Floor plan / satellite underlay drawn beneath grid and geometry. */
  const underlayInputRef = useRef<HTMLInputElement | null>(null);
  const [underlayObjectUrl, setUnderlayObjectUrl] = useState<string | null>(null);
  const [underlayHtmlImage, setUnderlayHtmlImage] = useState<HTMLImageElement | null>(null);
  const [underlayOpacity, setUnderlayOpacity] = useState(0.42);
  const [underlayScale, setUnderlayScale] = useState(0.35);
  const [underlayLocked, setUnderlayLocked] = useState(false);
  const [underlayPos, setUnderlayPos] = useState({ x: 0, y: 0 });

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
  const drawModeRef = useRef<"zone" | "rectangle" | "ellipse" | null>(null);
  const shiftKeyHeldRef = useRef(false);
  const polygonDraftRef = useRef<{ points: { x: number; y: number }[] } | null>(null);
  const [polygonDraft, setPolygonDraft] = useState<{ points: { x: number; y: number }[] } | null>(null);
  const [polygonHover, setPolygonHover] = useState<{ x: number; y: number } | null>(null);
  const penDraftRef = useRef<{ anchors: PenDraftAnchor[] } | null>(null);
  const [penDraft, setPenDraft] = useState<{ anchors: PenDraftAnchor[] } | null>(null);
  const [penHover, setPenHover] = useState<{ x: number; y: number } | null>(null);
  const penWinCleanupRef = useRef<(() => void) | null>(null);
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
  const blueprintMod = useModuleSettings("blueprint");
  const bpFlags = blueprintMod.settings as {
    showGrid?: boolean;
    enableSnapping?: boolean;
    enableAutoConnect?: boolean;
  };
  const blueprintSnapEnabledRef = useRef(bpFlags.enableSnapping !== false);
  const blueprintConnectSnapRef = useRef(bpFlags.enableSnapping !== false);
  const blueprintConnectAvoidRef = useRef(bpFlags.enableAutoConnect !== false);
  useEffect(() => {
    blueprintSnapEnabledRef.current = bpFlags.enableSnapping !== false;
    blueprintConnectSnapRef.current = bpFlags.enableSnapping !== false;
    blueprintConnectAvoidRef.current = bpFlags.enableAutoConnect !== false;
  }, [bpFlags.enableAutoConnect, bpFlags.enableSnapping]);
  const blueprintShowGrid = bpFlags.showGrid !== false;
  const [freeDrawPreview, setFreeDrawPreview] = useState<number[] | null>(null);
  const freeDrawAccumRef = useRef<number[]>([]);
  const freeDrawWinCleanupRef = useRef<(() => void) | null>(null);
  const elementsRef = useRef(elements);
  const selectedIdsRef = useRef(selectedIds);
  const canEditRef = useRef(true);
  const stageScaleRef = useRef(stageScale);
  type GroupDragState = { primaryId: string; starts: Map<string, { x: number; y: number }>; pathFlats: Map<string, number[]> };
  const groupDragRef = useRef<GroupDragState | null>(null);
  type ShiftDupSession = {
    oldToNew: Map<string, string>;
    primaryOld: string;
    primaryNew: string;
    primaryNodeStart: { x: number; y: number };
    cloneStarts: Map<string, { x: number; y: number; pathFlat?: number[] }>;
  };
  const shiftDupSessionRef = useRef<ShiftDupSession | null>(null);
  const transformUndoPrimedRef = useRef(false);
  const linkingForTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    linkingForTaskIdRef.current = linkingForTaskId;
  }, [linkingForTaskId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftKeyHeldRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftKeyHeldRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    if (tool !== "draw-polygon") {
      polygonDraftRef.current = null;
      setPolygonDraft(null);
      setPolygonHover(null);
    }
    if (tool !== "draw-pen") {
      penWinCleanupRef.current?.();
      penWinCleanupRef.current = null;
      penDraftRef.current = null;
      setPenDraft(null);
      setPenHover(null);
    }
    if (tool !== "draw-room" && tool !== "draw-rectangle" && tool !== "draw-ellipse") {
      drawOriginRef.current = null;
      drawModeRef.current = null;
      setDrawDraft(null);
    }
  }, [tool]);

  useEffect(() => {
    if (!saveNotice) return;
    const t = window.setTimeout(() => setSaveNotice(null), 14_000);
    return () => window.clearTimeout(t);
  }, [saveNotice]);

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
        const next0 = typeof updater === "function" ? updater(bp.elements) : updater;
        const next = syncBlueprintGroupBounds(next0);
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

  const reorderLayers = useCallback(
    (fromIndex: number, toIndex: number) => {
      updateBlueprint((bp) => {
        const L = [...bp.layers];
        const [row] = L.splice(fromIndex, 1);
        if (!row) return bp;
        L.splice(toIndex, 0, row);
        return { ...bp, layers: L };
      });
    },
    [updateBlueprint],
  );

  const addBlueprintLayer = useCallback(() => {
    const id = crypto.randomUUID();
    updateBlueprint((bp) => ({
      ...bp,
      layers: [{ id, name: `Layer ${bp.layers.length + 1}` }, ...bp.layers],
    }));
    setActiveLayerId(id);
  }, [updateBlueprint]);

  const deleteBlueprintLayer = useCallback(
    (id: string) => {
      updateBlueprint((bp) => {
        if (bp.layers.length <= 1) return bp;
        const ix = bp.layers.findIndex((l) => l.id === id);
        if (ix < 0) return bp;
        const oldBottom = bp.layers[bp.layers.length - 1]!.id;
        const deletingBottom = id === oldBottom;
        const nextLayers = bp.layers.filter((l) => l.id !== id);
        const fallback =
          ix + 1 < bp.layers.length ? bp.layers[ix + 1]!.id : bp.layers[ix - 1]!.id;
        return {
          ...bp,
          layers: nextLayers,
          elements: bp.elements.map((e) => {
            if (e.layer_id === id) return { ...e, layer_id: fallback };
            if (!e.layer_id && deletingBottom) return { ...e, layer_id: fallback };
            return e;
          }),
        };
      });
      setActiveLayerId((cur) => (cur === id ? null : cur));
    },
    [updateBlueprint],
  );

  const renameBlueprintLayer = useCallback(
    (id: string, name: string) => {
      updateBlueprint((bp) => ({
        ...bp,
        layers: bp.layers.map((L) => (L.id === id ? { ...L, name } : L)),
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
    penWinCleanupRef.current?.();
    penWinCleanupRef.current = null;
    penDraftRef.current = null;
    setPenDraft(null);
    setPenHover(null);
    setLinkingForTaskId(null);
    setTaskStepHighlight(null);
    setTaskStepPin(null);
  }, [tool]);

  useEffect(() => () => zoomAnimRef.current?.stop(), []);

  useLayoutEffect(() => {
    const w = stageSize.w;
    const h = stageSize.h;
    const epoch = viewLayoutEpoch;
    const prev = prevFitRef.current;
    const epochChanged = prev.epoch !== epoch;
    const sizeChanged = prev.w !== w || prev.h !== h;
    prevFitRef.current = { epoch, w, h };

    if (!epochChanged && sizeChanged && userTouchedPanZoomRef.current) {
      return;
    }

    const laidOut = relayoutAllDoors(elements);
    const b = unionBlueprintElementsBounds(laidOut);
    const pad = 56;
    let nextScale = 1;
    let nextPos = { x: pad, y: pad };
    if (b) {
      const bw = Math.max(40, b.R - b.L);
      const bh = Math.max(40, b.B - b.T);
      const sx = (w - pad * 2) / bw;
      const sy = (h - pad * 2) / bh;
      const s = Math.min(sx, sy, ZOOM_MAX);
      const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s));
      const cx = (b.L + b.R) / 2;
      const cy = (b.T + b.B) / 2;
      nextScale = clamped;
      nextPos = { x: w / 2 - cx * clamped, y: h / 2 - cy * clamped };
    }
    stageScaleRef.current = nextScale;
    stagePosRef.current = nextPos;
    setStageScale(nextScale);
    setStagePos(nextPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when epoch/stage size change; `elements` comes from that render
  }, [viewLayoutEpoch, stageSize.w, stageSize.h]);

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
    if (!freehandTune) return;
    if (selectedSingleId !== freehandTune.id) setFreehandTune(null);
  }, [selectedSingleId, freehandTune]);

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

  const underlayPlacedForUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!underlayHtmlImage || !underlayObjectUrl) {
      underlayPlacedForUrlRef.current = null;
      return;
    }
    if (underlayPlacedForUrlRef.current === underlayObjectUrl) return;
    underlayPlacedForUrlRef.current = underlayObjectUrl;
    const img = underlayHtmlImage;
    const host = hostRef.current;
    const r = host?.getBoundingClientRect();
    const wv = Math.max(320, Math.floor(r?.width ?? stageSize.w));
    const hv = Math.max(380, Math.floor(r?.height ?? stageSize.h));
    const sc = Math.max(0.001, stageScaleRef.current);
    const px = stagePosRef.current.x;
    const py = stagePosRef.current.y;
    const maxW = (wv * 0.9) / sc;
    const maxH = (hv * 0.9) / sc;
    const fit = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 3);
    const cx = (-px + wv / 2) / sc;
    const cy = (-py + hv / 2) / sc;
    setUnderlayScale(fit);
    setUnderlayPos({
      x: cx - (img.naturalWidth * fit) / 2,
      y: cy - (img.naturalHeight * fit) / 2,
    });
  }, [underlayHtmlImage, underlayObjectUrl, stageSize.w, stageSize.h]);

  useEffect(() => {
    connectStyleRef.current = connectStyle;
  }, [connectStyle]);

  const selectionBounds = useMemo(() => {
    if (selectedIds.length > 1) return unionSelectionAabb(new Set(selectedIds), elements);
    if (selectedIds.length === 1) {
      const el = elements.find((e) => e.id === selectedIds[0]);
      if (el?.type === "group") {
        const a = elementWorldAabb(el);
        if (a) return a;
      }
    }
    return null;
  }, [selectedIds, elements]);

  const canGroupPick = useMemo(
    () => blueprintIdsEligibleToFormGroup(elements, selectedIds),
    [elements, selectedIds],
  );

  const canConnectSelection = useMemo(() => {
    const ids = selectedIds.filter((id) => {
      const el = elements.find((e) => e.id === id);
      return (
        el && isBlueprintConnectEndpoint(el) && !isBlueprintElementEffectivelyLocked(elements, el)
      );
    });
    return ids.length >= 2;
  }, [elements, selectedIds]);

  const zonesInSelection = useMemo(() => {
    return selectedIds
      .map((id) => elements.find((e) => e.id === id))
      .filter((e): e is BlueprintElement => Boolean(e && e.type === "zone"));
  }, [selectedIds, elements]);

  const canMergeZones = zonesInSelection.length >= 2;

  const shapesMergeableInSelection = useMemo(() => {
    return selectedIds
      .map((id) => elements.find((e) => e.id === id))
      .filter(
        (e): e is BlueprintElement =>
          Boolean(
            e &&
              (e.type === "path" ||
                e.type === "polygon" ||
                e.type === "rectangle" ||
                e.type === "ellipse") &&
              !isBlueprintElementEffectivelyLocked(elements, e),
          ),
      );
  }, [selectedIds, elements]);

  const canMergeShapes = shapesMergeableInSelection.length >= 2;

  const mergeSelectedRooms = useCallback(() => {
    if (zonesInSelection.length < 2) return;
    const keepId = zonesInSelection[0]!.id;
    const removeIds = new Set(zonesInSelection.map((z) => z.id));
    const name =
      zonesInSelection
        .map((z) => z.name)
        .filter(Boolean)
        .join(" · ")
        .slice(0, 120) || "Merged room";
    checkpointBlueprint();
    commitElements((prev) => {
      const touchesMergedRoom = (e: BlueprintElement) => {
        if (e.type !== "door") return false;
        const p = parseWallAttach(e.wall_attachment);
        return Boolean(p && removeIds.has(p.zoneId));
      };
      const filtered = prev.filter((e) => !touchesMergedRoom(e));
      const zonesToMerge = zonesInSelection.map((z) => filtered.find((e) => e.id === z.id)).filter(Boolean) as BlueprintElement[];
      if (zonesToMerge.length < 2) return prev;
      const merged = mergeZonesUnion(keepId, name, zonesToMerge);
      if (!merged) return prev;
      const rest = filtered.filter((e) => !removeIds.has(e.id));
      return relayoutAllDoors([...rest, merged]);
    });
    setSelectedIds([keepId]);
    setSnapGuides([]);
  }, [zonesInSelection, commitElements, checkpointBlueprint]);

  const mergeSelectedShapes = useCallback(() => {
    if (shapesMergeableInSelection.length < 2) return;
    const keepId = shapesMergeableInSelection[0]!.id;
    const removeIds = new Set(shapesMergeableInSelection.map((z) => z.id));
    const name =
      shapesMergeableInSelection
        .map((z) => z.name)
        .filter(Boolean)
        .join(" · ")
        .slice(0, 120) || "Merged shape";
    checkpointBlueprint();
    commitElements((prev) => {
      const toMerge = shapesMergeableInSelection.map((z) => prev.find((e) => e.id === z.id)).filter(Boolean) as BlueprintElement[];
      if (toMerge.length < 2) return prev;
      const merged = mergeClosedShapesUnion(keepId, name, toMerge);
      if (!merged) return prev;
      const rest = prev.filter((e) => !removeIds.has(e.id));
      return relayoutAllDoors([...rest, merged]);
    });
    setSelectedIds([keepId]);
    setSnapGuides([]);
  }, [shapesMergeableInSelection, commitElements, checkpointBlueprint]);

  const groupSelected = useCallback(() => {
    const pick = blueprintIdsEligibleToFormGroup(elementsRef.current, selectedIdsRef.current);
    if (!pick) return;
    checkpointBlueprint();
    const gid = crypto.randomUUID();
    const bb = computeBlueprintGroupBounds(elementsRef.current, pick);
    if (!bb) return;
    const groupEl: BlueprintElement = {
      id: gid,
      type: "group",
      x: bb.x,
      y: bb.y,
      width: bb.width,
      height: bb.height,
      rotation: 0,
      children: pick,
      ...layerIdForNewGeometry(),
    };
    commitElements((prev) => [...prev, groupEl]);
    setSelectedIds([gid]);
    setSnapGuides([]);
  }, [checkpointBlueprint, commitElements, layerIdForNewGeometry]);

  const ungroupSelected = useCallback(() => {
    const sid = selectedIdsRef.current.length === 1 ? selectedIdsRef.current[0] : null;
    if (!sid) return;
    const cur = elementsRef.current;
    const el = cur.find((e) => e.id === sid);
    if (el?.type !== "group" || !el.children?.length) return;
    checkpointBlueprint();
    const childIds = [...el.children];
    commitElements((prev) => prev.filter((e) => e.id !== sid));
    setSelectedIds(childIds);
    setSnapGuides([]);
  }, [checkpointBlueprint, commitElements]);

  const toggleLockSelection = useCallback(() => {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    const cur = elementsRef.current;
    const anyUnlocked = ids.some((id) => {
      const row = cur.find((x) => x.id === id);
      return row && !row.locked;
    });
    const nextLocked = anyUnlocked;
    checkpointBlueprint();
    commitElements((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, locked: nextLocked } : e)));
  }, [checkpointBlueprint, commitElements]);

  const connectSelectedEndpoints = useCallback(() => {
    const cur = elementsRef.current;
    const ordered = blueprintConnectEndpointIdsInOrder(selectedIdsRef.current, cur, true);
    if (ordered.length < 2) return;
    const keys = existingConnectionPairKeys(cur);
    const style = connectStyleRef.current;
    const toAdd: BlueprintElement[] = [];
    for (let i = 0; i + 1 < ordered.length; i++) {
      const fromId = ordered[i]!;
      const toId = ordered[i + 1]!;
      const pk = blueprintConnectionPairKey(fromId, toId);
      if (keys.has(pk)) continue;
      keys.add(pk);
      const flat = buildOrthogonalConnectionPath({
        elements: cur,
        fromId,
        toId,
        snapToGrid: blueprintConnectSnapRef.current,
        avoidObstacles: blueprintConnectAvoidRef.current,
      });
      if (!flat || flat.length < 4) continue;
      toAdd.push(
        makeConnectionElement({
          id: crypto.randomUUID(),
          fromId,
          toId,
          flatPoints: flat,
          style,
          ...layerIdForNewGeometry(),
        }),
      );
    }
    if (toAdd.length === 0) return;
    checkpointBlueprint();
    commitElements((prev) => [...prev, ...toAdd]);
    setSelectedIds(toAdd.map((e) => e.id));
    setSnapGuides([]);
  }, [checkpointBlueprint, commitElements, layerIdForNewGeometry]);

  const commitPenPathFromAnchors = useCallback(
    (anchors: PenDraftAnchor[]) => {
      const flat0 = flattenPenDraftToClosedPath(anchors);
      if (!flat0) return;
      const processed =
        processFreehandPath(flat0, { ...freehandOptionsFromSlider(42), simplifyTolerance: 2.8 }) ?? flat0;
      const id = crypto.randomUUID();
      const { minX, minY, w, h } = bboxFromPathPoints(processed);
      checkpointBlueprint();
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
          name: "Pen",
          path_points: processed,
          ...layerIdForNewGeometry(),
        },
      ]);
      setSelectedIds([id]);
      penDraftRef.current = null;
      setPenDraft(null);
      setPenHover(null);
      setTool("select");
    },
    [checkpointBlueprint, commitElements, layerIdForNewGeometry],
  );

  const onPenOverlayPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (tool !== "draw-pen") return;
    e.cancelBubble = true;
    if (e.evt.pointerType === "mouse" && e.evt.button !== 0) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const w0 = getWorldFromStage(stage);
    if (!w0) return;
    const snap = (x: number, y: number) => ({
      x: Math.round(x / GRID) * GRID,
      y: Math.round(y / GRID) * GRID,
    });

    const anchors = penDraftRef.current?.anchors ?? [];
    const me = e.evt as PointerEvent & { detail?: number };
    if ((me.detail ?? 0) >= 2 && anchors.length >= 3) {
      commitPenPathFromAnchors(anchors);
      return;
    }

    const wPress = snap(w0.x, w0.y);
    penWinCleanupRef.current?.();
    penWinCleanupRef.current = null;

    const onMove = (ev: PointerEvent) => {
      const st = stageRef.current;
      if (!st) return;
      const rect = st.container().getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      const wx = (sx - st.x()) / st.scaleX();
      const wy = (sy - st.y()) / st.scaleY();
      setPenHover(snap(wx, wy));
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      penWinCleanupRef.current = null;
      setPenHover(null);

      const st = stageRef.current;
      if (!st) return;
      const rect = st.container().getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      const wx = (sx - st.x()) / st.scaleX();
      const wy = (sy - st.y()) / st.scaleY();
      const wRelease = snap(wx, wy);

      const cur = penDraftRef.current?.anchors ?? [];
      if (cur.length >= 3) {
        const first = cur[0]!;
        if (Math.hypot(wRelease.x - first.x, wRelease.y - first.y) <= POLY_CLOSE_PX) {
          commitPenPathFromAnchors(cur);
          return;
        }
      }

      if (cur.length === 0) {
        const next = { anchors: [{ x: wRelease.x, y: wRelease.y }] };
        penDraftRef.current = next;
        setPenDraft(next);
        return;
      }

      const drag = Math.hypot(wRelease.x - wPress.x, wRelease.y - wPress.y);
      const nextAnchor: PenDraftAnchor =
        drag >= PEN_DRAG_CURVE_PX
          ? { x: wRelease.x, y: wRelease.y, qc: { x: wPress.x, y: wPress.y } }
          : { x: wRelease.x, y: wRelease.y };
      const next = { anchors: [...cur, nextAnchor] };
      penDraftRef.current = next;
      setPenDraft(next);
    };

    penWinCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

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
      if (mod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleLockSelection();
        return;
      }

      if (e.key === "Enter" && toolRef.current === "draw-pen") {
        const anchors = penDraftRef.current?.anchors;
        if (anchors && anchors.length >= 3) {
          e.preventDefault();
          commitPenPathFromAnchors(anchors);
          return;
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setSymbolPanelOpen(false);
        setFreehandTune(null);
        polygonDraftRef.current = null;
        setPolygonDraft(null);
        setPolygonHover(null);
        penWinCleanupRef.current?.();
        penWinCleanupRef.current = null;
        penDraftRef.current = null;
        setPenDraft(null);
        setPenHover(null);
        drawOriginRef.current = null;
        drawModeRef.current = null;
        setDrawDraft(null);
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
        const drop = expandBlueprintSelectionForDeletion(elementsRef.current, selectedIdsRef.current);
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
      const idSet = expandBlueprintSelectionToEditableIds(elementsRef.current, ids);
      commitElements((prev) => {
        const next = prev.map((el) => {
          if (!idSet.has(el.id)) return el;
          if (isBlueprintElementEffectivelyLocked(prev, el)) return el;
          if (el.type === "door") return el;
          if (el.type === "path" && el.path_points && el.path_points.length >= 6) {
            const flat = el.path_points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
            const bb = bboxFromPathPoints(flat);
            return { ...el, path_points: flat, x: bb.minX, y: bb.minY, width: bb.w, height: bb.h };
          }
          if (el.type === "polygon" && el.path_points && el.path_points.length >= 6) {
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
        return syncBlueprintGroupBounds(relayoutAllDoors(out));
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, commitElements, groupSelected, ungroupSelected, toggleLockSelection, commitPenPathFromAnchors]);
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
  }, [immersiveOpen]);

  useEffect(() => {
    if (!underlayObjectUrl) {
      setUnderlayHtmlImage(null);
      return;
    }
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => {
      setUnderlayHtmlImage(img);
    };
    img.onerror = () => {
      setUnderlayHtmlImage(null);
    };
    img.src = underlayObjectUrl;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [underlayObjectUrl]);

  useEffect(() => {
    return () => {
      if (underlayObjectUrl) URL.revokeObjectURL(underlayObjectUrl);
    };
  }, [underlayObjectUrl]);

  useEffect(() => {
    if (!immersiveOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [immersiveOpen]);

  useEffect(() => {
    if (!immersiveOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImmersiveOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [immersiveOpen]);

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
      if (dx !== 0 || dy !== 0) userTouchedPanZoomRef.current = true;
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
      const loadedLayers = parseApiBlueprintLayers(d.layers);
      resetBlueprint({
        elements: relayoutAllDoors(d.elements.map(mapApiElement)),
        tasks: mapApiTasks(d.tasks),
        layers:
          loadedLayers.length > 0
            ? loadedLayers
            : [{ id: crypto.randomUUID(), name: "Layer 1" }],
      });
      setSelectedIds([]);
      setError(null);
      setSaveNotice(null);
      userTouchedPanZoomRef.current = false;
      setViewLayoutEpoch((n) => n + 1);
    } catch (e) {
      setError(blueprintApiUserMessage(e));
    }
  };

  const saveBlueprint = async () => {
    setSaving(true);
    setError(null);
    setSaveNotice(null);
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
        elements: toApiPayload(elements, layers),
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          mode: t.mode,
          content: t.content,
          linked_element_ids: t.linked_element_ids,
        })),
        layers: layers.map((L) => ({ id: L.id, name: L.name })),
      };
      if (blueprintId) {
        const d = await apiFetch<BlueprintDetail>(`/api/blueprints/${blueprintId}`, {
          method: "PUT",
          json: payload,
        });
        const savedLayers = parseApiBlueprintLayers(d.layers);
        resetBlueprint({
          elements: relayoutAllDoors(d.elements.map(mapApiElement)),
          tasks: mapApiTasks(d.tasks),
          layers:
            savedLayers.length > 0
              ? savedLayers
              : [{ id: crypto.randomUUID(), name: "Layer 1" }],
        });
      } else {
        const d = await apiFetch<BlueprintDetail>("/api/blueprints", { method: "POST", json: payload });
        setBlueprintId(d.id);
        const savedLayers = parseApiBlueprintLayers(d.layers);
        resetBlueprint({
          elements: relayoutAllDoors(d.elements.map(mapApiElement)),
          tasks: mapApiTasks(d.tasks),
          layers:
            savedLayers.length > 0
              ? savedLayers
              : [{ id: crypto.randomUUID(), name: "Layer 1" }],
        });
      }
      await refreshList();
      emitOnboardingMaybeUpdated();
      setSaveNotice(
        "Saved to your organization in Pulse. The blueprint is stored on the server (tenant database, with your company’s other data) and appears in the Blueprint menu above. Open Zones → Blueprint anytime to edit it again.",
      );
    } catch (e) {
      setSaveNotice(null);
      setError(blueprintApiUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const newBlueprint = () => {
    setBlueprintId(null);
    setBlueprintName("Untitled blueprint");
    resetBlueprint({
      elements: [],
      tasks: [],
      layers: [{ id: crypto.randomUUID(), name: "Layer 1" }],
    });
    setSelectedIds([]);
    setTool("select");
    setSaveNotice(null);
    userTouchedPanZoomRef.current = false;
    setViewLayoutEpoch((n) => n + 1);
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    userTouchedPanZoomRef.current = true;
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

  const beginBoxDraw = (mode: "zone" | "rectangle" | "ellipse", x: number, y: number) => {
    drawModeRef.current = mode;
    drawOriginRef.current = { x, y };
    setDrawDraft({ x, y, w: 0, h: 0 });
  };

  const updateDraw = (x: number, y: number) => {
    const o = drawOriginRef.current;
    if (!o) return;
    let w = x - o.x;
    let h = y - o.y;
    if (drawModeRef.current === "ellipse" && shiftKeyHeldRef.current) {
      const ax = Math.abs(w);
      const ay = Math.abs(h);
      const s = Math.min(ax, ay);
      w = w < 0 ? -s : s;
      h = h < 0 ? -s : s;
    }
    setDrawDraft({ x: w < 0 ? o.x + w : o.x, y: h < 0 ? o.y + h : o.y, w: Math.abs(w), h: Math.abs(h) });
  };

  const finishDraw = () => {
    const mode = drawModeRef.current;
    const o = drawOriginRef.current;
    const d = drawDraftRef.current;
    drawOriginRef.current = null;
    drawModeRef.current = null;
    setDrawDraft(null);
    drawDraftRef.current = null;
    if (!o || !d || d.w < MIN_ZONE || d.h < MIN_ZONE) return;
    const id = crypto.randomUUID();
    if (mode === "zone") {
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
          ...layerIdForNewGeometry(),
        },
      ]);
    } else if (mode === "rectangle") {
      commitElements((prev) => [
        ...prev,
        {
          id,
          type: "rectangle",
          x: d.x,
          y: d.y,
          width: d.w,
          height: d.h,
          rotation: 0,
          name: "Rectangle",
          cornerRadius: 0,
          ...layerIdForNewGeometry(),
        },
      ]);
    } else if (mode === "ellipse") {
      commitElements((prev) => [
        ...prev,
        {
          id,
          type: "ellipse",
          x: d.x,
          y: d.y,
          width: d.w,
          height: d.h,
          rotation: 0,
          name: "Ellipse",
          ...layerIdForNewGeometry(),
        },
      ]);
    } else {
      return;
    }
    setSelectedIds([id]);
    setTool("select");
  };

  const commitPolygonFromPoints = (pts: { x: number; y: number }[]) => {
    if (pts.length < 3) return;
    const flat: number[] = [];
    for (const p of pts) {
      flat.push(p.x, p.y);
    }
    const id = crypto.randomUUID();
    const { minX, minY, w, h } = bboxFromPathPoints(flat);
    commitElements((prev) => [
      ...prev,
      {
        id,
        type: "polygon",
        x: minX,
        y: minY,
        width: w,
        height: h,
        rotation: 0,
        name: "Polygon",
        path_points: flat,
        ...layerIdForNewGeometry(),
      },
    ]);
    setSelectedIds([id]);
    polygonDraftRef.current = null;
    setPolygonDraft(null);
    setPolygonHover(null);
    setTool("select");
  };

  const onPolygonOverlayPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (tool !== "draw-polygon") return;
    e.cancelBubble = true;
    if (e.evt.button !== 0) return;
    const st = e.target.getStage();
    const w0 = getWorldFromStage(st);
    if (!w0) return;
    const wx = Math.round(w0.x / GRID) * GRID;
    const wy = Math.round(w0.y / GRID) * GRID;
    const w = { x: wx, y: wy };

    const pts = polygonDraftRef.current?.points ?? [];
    const detail = "detail" in e.evt ? (e.evt as MouseEvent).detail : 1;
    if (detail >= 2) {
      if (pts.length >= 3) commitPolygonFromPoints(pts);
      return;
    }
    if (pts.length >= 3) {
      const first = pts[0]!;
      if (Math.hypot(w.x - first.x, w.y - first.y) <= POLY_CLOSE_PX) {
        commitPolygonFromPoints(pts);
        return;
      }
    }
    const next = { points: [...pts, w] };
    polygonDraftRef.current = next;
    setPolygonDraft(next);
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
        ...layerIdForNewGeometry(),
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
        ...layerIdForNewGeometry(),
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
          ...(zone.layer_id ? { layer_id: zone.layer_id } : layerIdForNewGeometry()),
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

  const onStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (
      (tool === "draw-room" || tool === "draw-rectangle" || tool === "draw-ellipse") &&
      drawOriginRef.current
    ) {
      const w = getWorldFromStage(stageRef.current);
      if (w) updateDraw(w.x, w.y);
    }
    if (tool === "draw-polygon" && polygonDraftRef.current) {
      const w = getWorldFromStage(e.target.getStage());
      if (w) {
        setPolygonHover({
          x: Math.round(w.x / GRID) * GRID,
          y: Math.round(w.y / GRID) * GRID,
        });
      }
    }
    if (tool === "draw-pen" && penDraftRef.current) {
      const w = getWorldFromStage(e.target.getStage());
      if (w) {
        setPenHover({
          x: Math.round(w.x / GRID) * GRID,
          y: Math.round(w.y / GRID) * GRID,
        });
      }
    }
  };

  const onStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (
      (tool === "draw-room" || tool === "draw-rectangle" || tool === "draw-ellipse") &&
      e.evt.button === 0 &&
      drawOriginRef.current
    ) {
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
      const processed = processFreehandPath(raw, freehandOptionsFromSlider(freehandSlider));
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
            ...layerIdForNewGeometry(),
          },
        ]);
        setSelectedIds([id]);
        setFreehandTune({ id, raw: [...raw] });
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
    const resolved = resolveBlueprintGroupDragMembers(currentElements, ids, primaryId);
    if (!resolved) {
      groupDragRef.current = null;
      return;
    }
    const memberIds = resolved.kind === "group" ? resolved.memberIds : resolved.ids;
    const starts = new Map<string, { x: number; y: number }>();
    const pathFlats = new Map<string, number[]>();
    for (const id of memberIds) {
      const o = currentElements.find((x) => x.id === id);
      if (!o || o.type === "door" || o.type === "connection") continue;
      if (isBlueprintElementEffectivelyLocked(currentElements, o)) continue;
      if (o.type === "path" && o.path_points && o.path_points.length >= 6) {
        starts.set(id, { x: 0, y: 0 });
        pathFlats.set(id, [...o.path_points]);
      } else if (o.type === "polygon" && o.path_points && o.path_points.length >= 6) {
        starts.set(id, { x: 0, y: 0 });
        pathFlats.set(id, [...o.path_points]);
      } else if (o.type === "zone" && zonePolygonFlat(o) && o.path_points) {
        starts.set(id, { x: 0, y: 0 });
        pathFlats.set(id, [...o.path_points]);
      } else {
        starts.set(id, { x: o.x, y: o.y });
      }
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
      const cur = elementsRef.current;
      const hitEl = cur.find((x) => x.id === id);
      if (hitEl && isBlueprintElementEffectivelyLocked(cur, hitEl)) return;

      const resolved = resolveBlueprintHitToSelectionId(cur, id);
      const ne = e.evt as MouseEvent | TouchEvent;
      const shift = "shiftKey" in ne ? ne.shiftKey : false;
      if (shift) {
        setSelectedIds((prev) => {
          const cand = prev.includes(resolved)
            ? prev.filter((x) => x !== resolved)
            : [...prev, resolved];
          return canonicalizeBlueprintSelectionIds(cur, cand);
        });
      } else {
        setSelectedIds([resolved]);
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
      const rawPicked0 = elementIdsInMarquee(elementsRef.current, { L, R, T, B });
      const picked = canonicalizeBlueprintSelectionIds(
        elementsRef.current,
        rawPicked0.filter((pid) => {
          const hit = elementsRef.current.find((e) => e.id === pid);
          return hit && !isBlueprintElementEffectivelyLocked(elementsRef.current, hit);
        }),
      );
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
        if ((row.type === "path" || row.type === "zone" || row.type === "polygon") && g.pathFlats.has(row.id)) {
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
      return syncBlueprintGroupBounds(next);
    });
    if (node.getClassName() === "Line") {
      node.position({ x: 0, y: 0 });
    }
    batchLayer();
  };

  const finishShiftDuplicateDrag = useCallback(() => {
    shiftDupSessionRef.current = null;
    setSnapGuides([]);
    groupDragRef.current = null;
  }, []);

  const applyShiftDuplicateDeltaFromNode = useCallback(
    (node: Konva.Node) => {
      const s = shiftDupSessionRef.current;
      if (!s) return;
      const dx = node.x() - s.primaryNodeStart.x;
      const dy = node.y() - s.primaryNodeStart.y;
      const prim = elementsRef.current.find((x) => x.id === s.primaryNew);
      let ndx = dx;
      let ndy = dy;
      let guides: SnapGuide[] = [];
      if (prim?.type === "zone" && !zonePolygonFlat(prim)) {
        const st0 = s.cloneStarts.get(s.primaryNew);
        if (st0 && st0.pathFlat === undefined) {
          const draft = { ...prim, x: st0.x + dx, y: st0.y + dy };
          const sn = snapZoneDrag(
            draft,
            st0.x + dx,
            st0.y + dy,
            elementsRef.current,
            blueprintSnapEnabledRef.current,
          );
          ndx = sn.x - st0.x;
          ndy = sn.y - st0.y;
          guides = sn.guides;
        }
      }
      setSnapGuides(guides);
      replaceElements((prev) => {
        const next = prev.map((row) => {
          const st = s.cloneStarts.get(row.id);
          if (!st) return row;
          if (
            st.pathFlat &&
            (row.type === "path" ||
              row.type === "connection" ||
              row.type === "polygon" ||
              (row.type === "zone" && row.path_points && row.path_points.length >= 6))
          ) {
            const flat = st.pathFlat.map((v, i) => (i % 2 === 0 ? v + ndx : v + ndy));
            const bb = bboxFromPathPoints(flat);
            return { ...row, path_points: flat, x: bb.minX, y: bb.minY, width: bb.w, height: bb.h };
          }
          return { ...row, x: st.x + ndx, y: st.y + ndy };
        });
        return syncBlueprintGroupBounds(relayoutAllDoors(next));
      });
      node.x(s.primaryNodeStart.x);
      node.y(s.primaryNodeStart.y);
      batchLayer();
    },
    [replaceElements, batchLayer],
  );

  const tryBeginShiftDuplicateDrag = useCallback(
    (primaryId: string, dragTarget: Konva.Node, evt: Konva.KonvaEventObject<DragEvent | MouseEvent>): boolean => {
      if (designerMode !== "edit" || !canEditRef.current || linkingForTaskIdRef.current) return false;
      const me = evt.evt as MouseEvent;
      if (!me.shiftKey) return false;
      let ids = [...selectedIdsRef.current];
      const cur = elementsRef.current;
      const childToGroup = buildBlueprintChildToGroupMap(cur);
      if (!ids.includes(primaryId)) {
        const g = childToGroup.get(primaryId);
        if (g && ids.includes(g)) ids = [g];
        else ids = [primaryId];
      }

      const isGroupDup = ids.some((id) => cur.find((x) => x.id === id)?.type === "group");
      if (!isGroupDup) {
        const polyPick = ids.filter((id) => {
          const row = cur.find((x) => x.id === id);
          return row?.type === "zone" && Boolean(zonePolygonFlat(row));
        });
        if (polyPick.length > 1) return false;
      }

      const oldToNew = new Map<string, string>();
      const clones: BlueprintElement[] = [];
      for (const id of ids) {
        const src = cur.find((x) => x.id === id);
        if (!src) continue;
        if (src.type === "group") {
          if (src.locked) continue;
          if (
            !src.children?.length ||
            src.children.some((cid) => {
              const ch = cur.find((x) => x.id === cid);
              return !ch || isBlueprintElementEffectivelyLocked(cur, ch);
            })
          )
            continue;
          const nGroupId = crypto.randomUUID();
          oldToNew.set(id, nGroupId);
          const idMap = new Map<string, string>();
          const genMembers: BlueprintElement[] = [];
          for (const cid of src.children) {
            const ch = cur.find((x) => x.id === cid);
            if (!ch) continue;
            const c = cloneBlueprintElementForShiftDup(ch, SHIFT_DUP_NUDGE, SHIFT_DUP_NUDGE);
            oldToNew.set(cid, c.id);
            idMap.set(cid, c.id);
            genMembers.push(c);
          }
          const childrenNew = src.children.map((cid) => idMap.get(cid)).filter((x): x is string => Boolean(x));
          if (childrenNew.length < 2) continue;
          const bb = computeBlueprintGroupBounds(genMembers, childrenNew);
          if (!bb) continue;
          clones.push(
            ...genMembers,
            {
              id: nGroupId,
              type: "group",
              x: bb.x,
              y: bb.y,
              width: bb.width,
              height: bb.height,
              rotation: 0,
              locked: undefined,
              children: childrenNew,
            },
          );
          continue;
        }
        if (isBlueprintElementEffectivelyLocked(cur, src)) continue;
        const c = cloneBlueprintElementForShiftDup(src, SHIFT_DUP_NUDGE, SHIFT_DUP_NUDGE);
        oldToNew.set(id, c.id);
        clones.push(c);
      }
      if (clones.length === 0) return false;
      const primaryNew = oldToNew.get(primaryId);
      if (!primaryNew) return false;

      checkpointBlueprint();

      const cloneStarts = new Map<string, { x: number; y: number; pathFlat?: number[] }>();
      for (const c of clones) {
        if (c.type === "group") continue;
        if ((c.type === "path" || c.type === "zone" || c.type === "polygon") && c.path_points && c.path_points.length >= 6) {
          cloneStarts.set(c.id, { x: 0, y: 0, pathFlat: [...c.path_points] });
        } else if (c.type === "connection" && c.path_points && c.path_points.length >= 4) {
          cloneStarts.set(c.id, { x: 0, y: 0, pathFlat: [...c.path_points] });
        } else {
          cloneStarts.set(c.id, { x: c.x, y: c.y });
        }
      }

      const newElements = syncBlueprintGroupBounds([...cur, ...clones]);
      replaceElements(() => newElements);
      elementsRef.current = newElements;

      const newSelection = ids.map((i) => oldToNew.get(i)).filter((x): x is string => Boolean(x));
      setSelectedIds(newSelection);
      selectedIdsRef.current = newSelection;

      shiftDupSessionRef.current = {
        oldToNew,
        primaryOld: primaryId,
        primaryNew,
        primaryNodeStart: { x: dragTarget.x(), y: dragTarget.y() },
        cloneStarts,
      };
      return true;
    },
    [checkpointBlueprint, designerMode, replaceElements],
  );

  const syncTransformToState = (id: string, node: Konva.Node) => {
    const curEls = elementsRef.current;
    const rowForTransform = curEls.find((e) => e.id === id);
    if (
      !rowForTransform ||
      rowForTransform.type === "group" ||
      rowForTransform.type === "connection" ||
      isBlueprintElementEffectivelyLocked(curEls, rowForTransform)
    )
      return;
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
      let next = prev.map((e) => {
        if (e.id !== id) return e;
        const base = { ...e, x, y, width, height, rotation };
        if (e.type === "rectangle") {
          return {
            ...base,
            cornerRadius: clampRectCornerRadius(width, height, e.cornerRadius ?? 0),
          };
        }
        return base;
      });
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
    if (
      sel &&
      (sel.type === "group" ||
        sel.type === "connection" ||
        sel.locked ||
        isBlueprintElementEffectivelyLocked(elements, sel))
    ) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    if (sel?.type === "door") n = doorInnerRefMap.current.get(selectedSingleId!) ?? null;
    else if (sel?.type === "zone" && !zonePolygonFlat(sel)) n = selectedNodeRef.current;
    else if (sel?.type === "device" || sel?.type === "symbol" || sel?.type === "rectangle" || sel?.type === "ellipse")
      n = selectedNodeRef.current;
    if (n && selectedSingleId && tool === "select") {
      tr.nodes([n]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedSingleId, elements, tool, stageSize.w, stageSize.h, designerMode, linkingForTaskId, stageScale]);

  const gridLines = (() => {
    if (!blueprintShowGrid) return [];
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

  const refineFreehandStroke = useCallback(
    (sliderVal: number) => {
      const v = Math.max(0, Math.min(100, sliderVal));
      setFreehandSlider(v);
      if (!freehandTune) return;
      const processed = processFreehandPath(freehandTune.raw, freehandOptionsFromSlider(v));
      if (!processed) return;
      replaceElements((prev) =>
        prev.map((row) => {
          if (row.id !== freehandTune.id || row.type !== "path") return row;
          const bb = bboxFromPathPoints(processed);
          return { ...row, path_points: processed, x: bb.minX, y: bb.minY, width: bb.w, height: bb.h };
        }),
      );
      transformUndoPrimedRef.current = false;
      batchLayer();
    },
    [freehandTune, replaceElements, batchLayer],
  );

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
      if (row.type === "polygon" && row.path_points && row.path_points.length >= 6) {
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
        return prev.map((x) =>
          x.id === selectedSingleId
            ? { ...x, path_points: rotated, x: bb.minX, y: bb.minY, width: bb.w, height: bb.h }
            : x,
        );
      }
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

  const wrapPulseFrame = (node: ReactNode) => {
    if (standalone) return node;
    if (fullscreen) {
      return <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{node}</div>;
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-ds-border bg-ds-primary p-2 shadow-[var(--ds-shadow-card)]">
        {node}
      </div>
    );
  };

  return (
    <div
      className={`bp-immersive-root${immersiveOpen ? " bp-immersive-root--open" : ""}`}
      role={immersiveOpen ? "dialog" : undefined}
      aria-modal={immersiveOpen ? "true" : undefined}
      aria-label={immersiveOpen ? "Blueprint editor, fullscreen" : undefined}
    >
      {immersiveOpen ? (
        <div className="bp-immersive-topbar">
          <span className="bp-immersive-topbar__title">Blueprint editor</span>
          <button type="button" className="bp-btn bp-btn--ghost" onClick={() => setImmersiveOpen(false)}>
            Close
          </button>
        </div>
      ) : null}
      {wrapPulseFrame(
    <div
      className={`bp-shell${isPublish ? " bp-shell--publish" : ""}${!standalone ? " bp-shell--pulse" : ""}${fullscreen ? " bp-shell--fullscreen" : ""}${immersiveOpen ? " bp-shell--immersive" : ""}`}
    >
      <motion.aside
        className={`bp-sidebar${isPublish ? " bp-sidebar--disabled" : ""}`}
        aria-label="Blueprint tasks"
        initial={false}
        animate={{ opacity: 1, x: 0 }}
        transition={bpTransition.med}
      >
        {standalone ? (
          <p className="bp-hint" style={{ marginBottom: 12 }}>
            Public playground: same editor as Pulse. <strong>Publish</strong> to export PNG/PDF. Saving to your org
            requires signing in on the{" "}
            <a href={pulseApp.login()} className="ds-link font-semibold">
              Pulse app
            </a>
            .
          </p>
        ) : null}
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
          Zoom: scroll wheel. Pan: Space+drag or right-drag. Tools and selection actions sit on the floating bar below the
          canvas. Free draw uses simplify-js + Catmull–Rom smoothing (adjust right after drawing). Pen tool: click/drag
          for Bézier-like segments, then close the path. Merge shapes: select two or more paths, polygons, rectangles, or
          ellipses (Shift or box) then Merge shapes for a boolean union. Merge rooms: select multiple zones then Merge.
          Duplicate: hold Shift and drag a selection to clone it (one undo reverses the copy and move). Doors: use handles or type width (32 px ≈ 1 m).
        </p>
      </motion.aside>

      <div className="bp-workspace">
      <motion.div
        className={`bp-canvas-wrap bp-canvas-wrap--with-float${isPublish ? " bp-canvas-wrap--publish" : ""}`}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={bpTransition.med}
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
          className={`bp-toolbar${immersiveOpen ? " bp-toolbar--compact" : ""}`}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={bpTransition.fast}
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
              setSaveNotice(null);
            }}
            whileHover={isPublish ? undefined : { scale: 1.02, boxShadow: "0 8px 24px rgba(16, 185, 129, 0.18)" }}
            whileTap={isPublish ? undefined : { scale: 0.985 }}
            transition={bpTransition.fast}
          >
            Publish
          </motion.button>
          <motion.button
            type="button"
            className="bp-btn bp-btn--ghost"
            disabled={isPublish}
            title={immersiveOpen ? "Return to embedded layout" : "Fullscreen overlay (Escape to close)"}
            onClick={() => setImmersiveOpen((v) => !v)}
            whileHover={isPublish ? undefined : { scale: 1.02 }}
            whileTap={isPublish ? undefined : { scale: 0.985 }}
            transition={bpTransition.fast}
          >
            {immersiveOpen ? "Exit fullscreen" : "Fullscreen"}
          </motion.button>
          <motion.button
            type="button"
            className="bp-btn bp-btn--ghost"
            disabled={isPublish}
            title="Open the designer in a new browser tab"
            onClick={openDesignerInNewTab}
            whileHover={isPublish ? undefined : { scale: 1.02 }}
            whileTap={isPublish ? undefined : { scale: 0.985 }}
            transition={bpTransition.fast}
          >
            New tab
          </motion.button>
          {!standalone ? (
            <ModuleSettingsGear moduleId="blueprint" label="Blueprint designer organization settings" />
          ) : null}
        </motion.div>
        {!isPublish ? (
          <div className={`bp-underlay-panel${immersiveOpen ? " bp-underlay-panel--compact" : ""}`}>
            <input
              ref={underlayInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Choose floor plan underlay image"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUnderlayObjectUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return URL.createObjectURL(f);
                });
                underlayPlacedForUrlRef.current = null;
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="bp-btn bp-btn--ghost"
              disabled={!canEdit}
              onClick={() => underlayInputRef.current?.click()}
            >
              Underlay…
            </button>
            {underlayHtmlImage ? (
              <>
                <button
                  type="button"
                  className="bp-btn bp-btn--ghost"
                  disabled={!canEdit}
                  onClick={() => {
                    setUnderlayObjectUrl((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return null;
                    });
                    setUnderlayHtmlImage(null);
                    underlayPlacedForUrlRef.current = null;
                  }}
                >
                  Clear underlay
                </button>
                <label className="bp-underlay-field">
                  <span>Opacity</span>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={Math.round(underlayOpacity * 100)}
                    disabled={!canEdit}
                    onChange={(e) => setUnderlayOpacity(Number(e.target.value) / 100)}
                  />
                </label>
                <label className="bp-underlay-field">
                  <span>Zoom</span>
                  <input
                    type="range"
                    min={2}
                    max={300}
                    value={Math.round(underlayScale * 100)}
                    disabled={!canEdit || underlayLocked}
                    onChange={(e) => setUnderlayScale(Number(e.target.value) / 100)}
                  />
                </label>
                <label className="bp-underlay-lock">
                  <input
                    type="checkbox"
                    checked={underlayLocked}
                    disabled={!canEdit}
                    onChange={(e) => setUnderlayLocked(e.target.checked)}
                  />
                  <span>Lock</span>
                </label>
                <span className="bp-underlay-hint">
                  {underlayLocked
                    ? "Unlock to scale or drag the image (Select tool)."
                    : "Select tool: drag the image to align."}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
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
        <AnimatePresence>
          {saveNotice && !error ? (
            <motion.div
              key="save-notice"
              className="bp-save-notice"
              role="status"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={bpTransition.med}
            >
              <p className="bp-save-notice__text">{saveNotice}</p>
              <button type="button" className="bp-save-notice__dismiss" onClick={() => setSaveNotice(null)}>
                Dismiss
              </button>
            </motion.div>
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
            {underlayHtmlImage ? (
              <Layer name="blueprint-underlay">
                <KonvaImage
                  name="blueprint-underlay-image"
                  image={underlayHtmlImage}
                  x={underlayPos.x}
                  y={underlayPos.y}
                  width={underlayHtmlImage.naturalWidth * underlayScale}
                  height={underlayHtmlImage.naturalHeight * underlayScale}
                  opacity={underlayOpacity}
                  listening={!underlayLocked && canEdit && !isPublish && tool === "select"}
                  draggable={!underlayLocked && canEdit && !isPublish && tool === "select"}
                  onDragEnd={(e) => {
                    const node = e.target;
                    setUnderlayPos({ x: node.x(), y: node.y() });
                  }}
                />
              </Layer>
            ) : null}
            <Layer ref={layerRef} sortChildren>
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
                listening={canEdit && (tool === "select" || tool === "draw-room" || tool === "draw-rectangle" || tool === "draw-ellipse")}
                onMouseDown={(e) => {
                  if (!canEdit) return;
                  if (
                    (tool === "draw-room" || tool === "draw-rectangle" || tool === "draw-ellipse") &&
                    e.evt.button === 0
                  ) {
                    e.cancelBubble = true;
                    const st = e.target.getStage();
                    const w = getWorldFromStage(st);
                    if (!w) return;
                    const mode = tool === "draw-room" ? "zone" : tool === "draw-rectangle" ? "rectangle" : "ellipse";
                    beginBoxDraw(mode, w.x, w.y);
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
                  const effLocked = isBlueprintElementEffectivelyLocked(elements, el);
                  const interactSelect = canEdit && tool === "select" && !effLocked;
                  const zGlow = canEdit && tool === "select" && !sel && hoverZoneId === el.id;
                  const tg = taskGlowIds.has(el.id);
                  const zoneFill = isPublish ? "rgba(248, 250, 252, 0.085)" : ZONE_FACE_FILL;
                  const zoneStroke = isPublish ? "rgba(241, 245, 249, 0.94)" : ZONE_OUTLINE;
                  const sw = pubLine(Math.max(0.75, 1.22 / stageScale));
                  if (polyPts) {
                    const bb = bboxFromPathPoints(polyPts);
                    const labelSize = pubFs(Math.min(11, Math.max(9, Math.min(bb.w, bb.h) / 7)));
                    return (
                      <Group key={el.id} {...ez(el.id)}>
                        <Line
                          points={polyPts}
                          closed
                          tension={0}
                          fill={zoneFill}
                          stroke={
                          tg
                            ? "rgba(56, 189, 248, 0.75)"
                            : canMergeZones && zonesInSelection.some((z) => z.id === el.id)
                              ? "rgba(250, 204, 21, 0.75)"
                              : zoneStroke
                        }
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
                          listening={interactSelect}
                          draggable={interactSelect}
                          opacity={effLocked ? 0.74 : 1}
                          dash={effLocked ? [7, 5] : undefined}
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
                              if (!tryBeginShiftDuplicateDrag(el.id, e.target, e)) checkpointBlueprint();
                            }
                            if (!shiftDupSessionRef.current) initMultiDragIfNeeded(el.id);
                            if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                          }}
                          onDragMove={(e) => {
                            if (shiftDupSessionRef.current?.primaryOld === el.id) {
                              applyShiftDuplicateDeltaFromNode(e.target);
                              return;
                            }
                            const g = groupDragRef.current;
                            if (g && g.primaryId === el.id) {
                              flushMultiDragMove(el.id, e.target);
                              return;
                            }
                            batchLayer();
                          }}
                          onDragEnd={(e) => {
                            if (shiftDupSessionRef.current?.primaryOld === el.id) {
                              setIsDraggingSelection(false);
                              runDragScale(e.target as Konva.Line, 1);
                              replaceElements((prev) => relayoutAllDoors(prev));
                              finishShiftDuplicateDrag();
                              return;
                            }
                            setIsDraggingSelection(false);
                            const g = groupDragRef.current;
                            const wasMulti = g && g.primaryId === el.id;
                            if (wasMulti) groupDragRef.current = null;
                            const node = e.target as Konva.Line;
                            runDragScale(node, 1);
                            if (wasMulti) {
                              replaceElements((prev) => syncBlueprintGroupBounds(relayoutAllDoors(prev)));
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
                    <Group key={el.id} {...ez(el.id)}>
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
                        shadowOffset={{ x: 0, y: sel ? 0 : 2 }}
                        hitStrokeWidth={ZONE_EDGE_HIT_PX / Math.max(0.35, stageScale)}
                        listening={interactSelect}
                        draggable={interactSelect}
                        opacity={effLocked ? 0.74 : 1}
                        strokeWidth={effLocked ? sw * 1.05 : tg ? sw * 1.35 : sw}
                        dash={effLocked ? [8, 5] : undefined}
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
                            if (!tryBeginShiftDuplicateDrag(el.id, e.target, e)) checkpointBlueprint();
                          }
                          if (!shiftDupSessionRef.current) initMultiDragIfNeeded(el.id);
                          if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                        }}
                        onDragMove={(e) => {
                          if (!canEdit || tool !== "select") return;
                          const node = e.target;
                          if (shiftDupSessionRef.current?.primaryOld === el.id) {
                            applyShiftDuplicateDeltaFromNode(node);
                            return;
                          }
                          const g = groupDragRef.current;
                          if (g && g.primaryId === el.id) {
                            setSnapGuides([]);
                            flushMultiDragMove(el.id, node);
                            return;
                          }
                          const { x, y, guides } = snapZoneDrag(
                            el,
                            node.x(),
                            node.y(),
                            elements,
                            blueprintSnapEnabledRef.current,
                          );
                          node.x(x);
                          node.y(y);
                          setSnapGuides(guides);
                          batchLayer();
                        }}
                        onDragEnd={(e) => {
                          if (shiftDupSessionRef.current?.primaryOld === el.id) {
                            setIsDraggingSelection(false);
                            runDragScale(e.target, 1);
                            replaceElements((prev) => relayoutAllDoors(prev));
                            setSnapGuides([]);
                            finishShiftDuplicateDrag();
                            return;
                          }
                          setIsDraggingSelection(false);
                          const g = groupDragRef.current;
                          const wasMulti = g && g.primaryId === el.id;
                          if (wasMulti) groupDragRef.current = null;
                          const node = e.target;
                          runDragScale(node, 1);
                          setSnapGuides([]);
                          if (wasMulti) {
                            replaceElements((prev) => syncBlueprintGroupBounds(relayoutAllDoors(prev)));
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
                .filter((el) => el.type === "rectangle")
                .map((el) => {
                  const w = el.width ?? MIN_ZONE;
                  const h = el.height ?? MIN_ZONE;
                  const sel = selectedIds.includes(el.id);
                  const effLocked = isBlueprintElementEffectivelyLocked(elements, el);
                  const interactSelect = canEdit && tool === "select" && !effLocked;
                  const sw = pubLine(Math.max(0.65, 1 / stageScale));
                  const cr = clampRectCornerRadius(w, h, el.cornerRadius ?? 0);
                  const tg = taskGlowIds.has(el.id);
                  return (
                    <Rect
                      key={el.id}
                      {...ez(el.id)}
                      ref={(node) => {
                        if (el.id === selectedSingleId && tool === "select" && canEdit && selected?.type === "rectangle") {
                          selectedNodeRef.current = node;
                        }
                      }}
                      x={el.x}
                      y={el.y}
                      width={w}
                      height={h}
                      rotation={el.rotation ?? 0}
                      cornerRadius={cr}
                      fill={ANNOT_RECT_FILL}
                      stroke={tg ? "rgba(56, 189, 248, 0.82)" : sel ? "rgba(96, 165, 250, 0.6)" : ANNOT_RECT_STROKE}
                      strokeWidth={tg ? sw * 1.35 : sw}
                      dash={effLocked ? [7, 5] : undefined}
                      opacity={effLocked ? 0.74 : 1}
                      hitStrokeWidth={ZONE_EDGE_HIT_PX / Math.max(0.35, stageScale)}
                      listening={interactSelect}
                      draggable={interactSelect}
                      onClick={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onTap={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onDragStart={(e) => {
                        if (canEdit && tool === "select") {
                          setIsDraggingSelection(true);
                          if (!tryBeginShiftDuplicateDrag(el.id, e.target, e)) checkpointBlueprint();
                        }
                        if (!shiftDupSessionRef.current) initMultiDragIfNeeded(el.id);
                        if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragMove={(e) => {
                        if (!canEdit || tool !== "select") return;
                        const node = e.target;
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          applyShiftDuplicateDeltaFromNode(node);
                          return;
                        }
                        if (groupDragRef.current && groupDragRef.current.primaryId === el.id) {
                          flushMultiDragMove(el.id, node);
                        }
                      }}
                      onDragEnd={(e) => {
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          setIsDraggingSelection(false);
                          runDragScale(e.target, 1);
                          replaceElements((prev) => relayoutAllDoors(prev));
                          finishShiftDuplicateDrag();
                          return;
                        }
                        setIsDraggingSelection(false);
                        const g = groupDragRef.current;
                        const wasMulti = g && g.primaryId === el.id;
                        if (wasMulti) groupDragRef.current = null;
                        runDragScale(e.target, 1);
                        if (wasMulti) {
                          replaceElements((prev) => syncBlueprintGroupBounds(relayoutAllDoors(prev)));
                          return;
                        }
                        const nx = e.target.x();
                        const ny = e.target.y();
                        replaceElements((prev) => prev.map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x)));
                      }}
                      onTransformEnd={(e) => syncTransformToState(el.id, e.target)}
                    />
                  );
                })}
              {elements
                .filter((el) => el.type === "ellipse")
                .map((el) => {
                  const w = el.width ?? MIN_ZONE;
                  const h = el.height ?? MIN_ZONE;
                  const sel = selectedIds.includes(el.id);
                  const effLocked = isBlueprintElementEffectivelyLocked(elements, el);
                  const interactSelect = canEdit && tool === "select" && !effLocked;
                  const sw = pubLine(Math.max(0.65, 1 / stageScale));
                  const tg = taskGlowIds.has(el.id);
                  return (
                    <Group
                      key={el.id}
                      {...ez(el.id)}
                      ref={(node) => {
                        if (el.id === selectedSingleId && tool === "select" && canEdit && selected?.type === "ellipse") {
                          selectedNodeRef.current = node;
                        }
                      }}
                      x={el.x}
                      y={el.y}
                      rotation={el.rotation ?? 0}
                      listening={interactSelect}
                      draggable={interactSelect}
                      opacity={effLocked ? 0.74 : 1}
                      onClick={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onTap={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onDragStart={(e) => {
                        if (canEdit && tool === "select") {
                          setIsDraggingSelection(true);
                          if (!tryBeginShiftDuplicateDrag(el.id, e.target, e)) checkpointBlueprint();
                        }
                        if (!shiftDupSessionRef.current) initMultiDragIfNeeded(el.id);
                        if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragMove={(e) => {
                        if (!canEdit || tool !== "select") return;
                        const node = e.target;
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          applyShiftDuplicateDeltaFromNode(node);
                          return;
                        }
                        if (groupDragRef.current && groupDragRef.current.primaryId === el.id) {
                          flushMultiDragMove(el.id, node);
                        }
                      }}
                      onDragEnd={(e) => {
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          setIsDraggingSelection(false);
                          runDragScale(e.target, 1);
                          replaceElements((prev) => relayoutAllDoors(prev));
                          finishShiftDuplicateDrag();
                          return;
                        }
                        setIsDraggingSelection(false);
                        const g = groupDragRef.current;
                        const wasMulti = g && g.primaryId === el.id;
                        if (wasMulti) groupDragRef.current = null;
                        runDragScale(e.target, 1);
                        if (wasMulti) {
                          replaceElements((prev) => syncBlueprintGroupBounds(relayoutAllDoors(prev)));
                          return;
                        }
                        const nx = e.target.x();
                        const ny = e.target.y();
                        replaceElements((prev) => prev.map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x)));
                      }}
                      onTransformEnd={(e) => syncTransformToState(el.id, e.target)}
                    >
                      <Ellipse
                        x={w / 2}
                        y={h / 2}
                        radiusX={Math.max(1, w / 2)}
                        radiusY={Math.max(1, h / 2)}
                        fill={ANNOT_ELLIPSE_FILL}
                        stroke={tg ? "rgba(56, 189, 248, 0.85)" : sel ? "rgba(125, 211, 252, 0.72)" : ANNOT_ELLIPSE_STROKE}
                        strokeWidth={tg ? sw * 1.35 : sw}
                        dash={effLocked ? [7, 5] : undefined}
                        listening={false}
                      />
                    </Group>
                  );
                })}
              {elements
                .filter((el) => el.type === "polygon" && (el.path_points?.length ?? 0) >= 6)
                .map((el) => {
                  const pts = el.path_points ?? [];
                  const sel = selectedIds.includes(el.id);
                  const effLocked = isBlueprintElementEffectivelyLocked(elements, el);
                  const interactSelect = canEdit && tool === "select" && !effLocked;
                  const sw = pubLine(Math.max(0.65, 1 / stageScale));
                  const tg = taskGlowIds.has(el.id);
                  const showHandles = canEdit && tool === "select" && sel && !effLocked;
                  const nVerts = pts.length / 2;
                  return (
                    <Group key={el.id} listening={false} {...ez(el.id)}>
                      <Line
                        points={pts}
                        closed
                        tension={0}
                        fill={ANNOT_POLY_FILL}
                        stroke={tg ? "rgba(56, 189, 248, 0.9)" : sel ? "rgba(196, 181, 253, 0.85)" : ANNOT_POLY_STROKE}
                        strokeWidth={tg ? sw * 1.35 : sw}
                        lineJoin="round"
                        listening={interactSelect}
                        draggable={interactSelect}
                        opacity={effLocked ? 0.74 : 1}
                        dash={effLocked ? [8, 5] : undefined}
                        hitStrokeWidth={Math.max(16, 14 / stageScale)}
                        onClick={(e) => canEdit && handleSelectElementClick(e, el.id)}
                        onTap={(e) => canEdit && handleSelectElementClick(e, el.id)}
                        onDragStart={(e) => {
                          if (canEdit && tool === "select") {
                            setIsDraggingSelection(true);
                            if (!tryBeginShiftDuplicateDrag(el.id, e.target, e)) checkpointBlueprint();
                          }
                          if (!shiftDupSessionRef.current) initMultiDragIfNeeded(el.id);
                          if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                        }}
                        onDragMove={(e) => {
                          if (!canEdit || tool !== "select") return;
                          const node = e.target;
                          if (shiftDupSessionRef.current?.primaryOld === el.id) {
                            applyShiftDuplicateDeltaFromNode(node);
                            return;
                          }
                          if (groupDragRef.current && groupDragRef.current.primaryId === el.id) {
                            flushMultiDragMove(el.id, node);
                          }
                        }}
                        onDragEnd={(e) => {
                          if (shiftDupSessionRef.current?.primaryOld === el.id) {
                            setIsDraggingSelection(false);
                            runDragScale(e.target as Konva.Line, 1);
                            replaceElements((prev) => relayoutAllDoors(prev));
                            finishShiftDuplicateDrag();
                            return;
                          }
                          setIsDraggingSelection(false);
                          const g = groupDragRef.current;
                          const wasMulti = g && g.primaryId === el.id;
                          if (wasMulti) groupDragRef.current = null;
                          const node = e.target as Konva.Line;
                          runDragScale(node, 1);
                          if (wasMulti) {
                            node.position({ x: 0, y: 0 });
                            replaceElements((prev) => syncBlueprintGroupBounds(relayoutAllDoors(prev)));
                            return;
                          }
                          const ox = node.x();
                          const oy = node.y();
                          node.position({ x: 0, y: 0 });
                          replaceElements((prev) =>
                            prev.map((row) => {
                              if (row.id !== el.id || row.type !== "polygon" || !row.path_points || row.path_points.length < 6) {
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
                      {showHandles
                        ? Array.from({ length: nVerts }, (_, vi) => {
                            const px = pts[vi * 2]!;
                            const py = pts[vi * 2 + 1]!;
                            return (
                              <Circle
                                key={`${el.id}-v-${vi}`}
                                x={px}
                                y={py}
                                radius={POLY_HANDLE_R}
                                fill="rgba(15, 23, 42, 0.92)"
                                stroke="rgba(196, 181, 253, 0.9)"
                                strokeWidth={Math.max(1, 1.2 / stageScale)}
                                draggable
                                onDragStart={(e) => {
                                  e.cancelBubble = true;
                                  checkpointBlueprint();
                                }}
                                onDragMove={(e) => {
                                  e.cancelBubble = true;
                                  const nx = e.target.x();
                                  const ny = e.target.y();
                                  replaceElements((prev) =>
                                    prev.map((row) => {
                                      if (row.id !== el.id || row.type !== "polygon" || !row.path_points) return row;
                                      const flat = [...row.path_points];
                                      flat[vi * 2] = nx;
                                      flat[vi * 2 + 1] = ny;
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
                                  batchLayer();
                                }}
                                onDragEnd={(e) => {
                                  e.cancelBubble = true;
                                  const nx = e.target.x();
                                  const ny = e.target.y();
                                  e.target.x(nx);
                                  e.target.y(ny);
                                  batchLayer();
                                }}
                              />
                            );
                          })
                        : null}
                    </Group>
                  );
                })}
              {elements
                .filter((el) => el.type === "door")
                .map((el) => {
                  const sel = selectedIds.includes(el.id);
                  const effLocked = isBlueprintElementEffectivelyLocked(elements, el);
                  const interactSelect = canEdit && tool === "select" && !effLocked;
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
                      {...ez(el.id)}
                      x={el.x}
                      y={el.y}
                      rotation={rot}
                      scaleX={tg ? 1.08 : 1}
                      scaleY={tg ? 1.08 : 1}
                      opacity={effLocked ? 0.76 : 1}
                      listening={interactSelect}
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
                        dash={effLocked ? [6, 4] : undefined}
                        listening={interactSelect}
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
                  const effLocked = isBlueprintElementEffectivelyLocked(elements, el);
                  const interactSelect = canEdit && tool === "select" && !effLocked;
                  const sGlow = canEdit && tool === "select" && !sel && hoverSymbolId === el.id;
                  const stg = taskGlowIds.has(el.id);
                  const symLabelFs = pubFs(Math.min(9, w / 5));
                  const labelBand = Math.ceil(symLabelFs + SYMBOL_LABEL_BAND_GAP);
                  const iconSlotH = Math.max(4, h - labelBand);
                  return (
                    <Group
                      key={el.id}
                      {...ez(el.id)}
                      ref={(node) => {
                        if (
                          el.id === selectedSingleId &&
                          tool === "select" &&
                          canEdit &&
                          selected?.type === "symbol"
                        ) {
                          selectedNodeRef.current = node;
                        }
                      }}
                      x={el.x}
                      y={el.y}
                      rotation={el.rotation ?? 0}
                      scaleX={stg ? 1.06 : 1}
                      scaleY={stg ? 1.06 : 1}
                      listening={interactSelect}
                      draggable={interactSelect}
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
                          if (!tryBeginShiftDuplicateDrag(el.id, e.target, e)) checkpointBlueprint();
                        }
                        if (!shiftDupSessionRef.current) initMultiDragIfNeeded(el.id);
                        if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragMove={(e) => {
                        if (!canEdit || tool !== "select") return;
                        const node = e.target;
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          applyShiftDuplicateDeltaFromNode(node);
                          return;
                        }
                        if (groupDragRef.current && groupDragRef.current.primaryId === el.id) {
                          flushMultiDragMove(el.id, node);
                        }
                      }}
                      onDragEnd={(e) => {
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          setIsDraggingSelection(false);
                          runDragScale(e.target, 1);
                          replaceElements((prev) => relayoutAllDoors(prev));
                          finishShiftDuplicateDrag();
                          return;
                        }
                        setIsDraggingSelection(false);
                        const g = groupDragRef.current;
                        const wasMulti = g && g.primaryId === el.id;
                        if (wasMulti) groupDragRef.current = null;
                        const node = e.target;
                        runDragScale(node, 1);
                        if (wasMulti) {
                          replaceElements((prev) => syncBlueprintGroupBounds(relayoutAllDoors(prev)));
                          return;
                        }
                        const nx = node.x();
                        const ny = node.y();
                        replaceElements((prev) =>
                          prev.map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x)),
                        );
                      }}
                      onTransformEnd={(e) => syncTransformToState(el.id, e.target)}
                      onMouseEnter={() => {
                        if (canEdit && tool === "select") setCanvasHoverElementId(el.id);
                        if (canEdit && tool === "select" && !sel) setHoverSymbolId(el.id);
                      }}
                      onMouseLeave={() => {
                        setCanvasHoverElementId((z) => (z === el.id ? null : z));
                        setHoverSymbolId((z) => (z === el.id ? null : z));
                      }}
                      opacity={effLocked ? 0.74 : 0.98}
                    >
                      <Rect
                        width={w}
                        height={h}
                        cornerRadius={8}
                        fill={isPublish ? "rgba(248, 250, 252, 0.1)" : "rgba(15, 23, 42, 0.14)"}
                        stroke={effLocked ? "rgba(148, 163, 184, 0.45)" : undefined}
                        strokeWidth={effLocked ? 1.15 : 0}
                        dash={effLocked ? [6, 4] : undefined}
                        strokeEnabled={effLocked}
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
                  const effLocked = isBlueprintElementEffectivelyLocked(elements, el);
                  const interactSelect = canEdit && tool === "select" && !effLocked;
                  const dStroke = pubLine(Math.max(0.65, 0.92 / stageScale));
                  const dGlow = canEdit && tool === "select" && !sel && hoverDeviceId === el.id;
                  const dtg = taskGlowIds.has(el.id);
                  const pulse = !isPublish && (st === "alarm" || st === "warning");
                  return (
                    <Group
                      key={el.id}
                      {...ez(el.id)}
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
                      listening={interactSelect}
                      draggable={interactSelect}
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
                          if (!tryBeginShiftDuplicateDrag(el.id, e.target, e)) checkpointBlueprint();
                        }
                        if (!shiftDupSessionRef.current) initMultiDragIfNeeded(el.id);
                        if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragMove={(e) => {
                        if (!canEdit || tool !== "select") return;
                        const node = e.target;
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          applyShiftDuplicateDeltaFromNode(node);
                          return;
                        }
                        if (groupDragRef.current && groupDragRef.current.primaryId === el.id) {
                          flushMultiDragMove(el.id, node);
                        }
                      }}
                      onDragEnd={(e) => {
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          setIsDraggingSelection(false);
                          runDragScale(e.target, 1);
                          replaceElements((prev) => relayoutAllDoors(prev));
                          finishShiftDuplicateDrag();
                          return;
                        }
                        setIsDraggingSelection(false);
                        const g = groupDragRef.current;
                        const wasMulti = g && g.primaryId === el.id;
                        if (wasMulti) groupDragRef.current = null;
                        const node = e.target;
                        runDragScale(node, 1);
                        if (wasMulti) {
                          replaceElements((prev) => syncBlueprintGroupBounds(relayoutAllDoors(prev)));
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
                        const baseOp = isPublish ? 1 : effLocked ? 0.74 : 0.97;
                        e.currentTarget.opacity(sel ? 1 : baseOp);
                      }}
                      opacity={isPublish ? 1 : effLocked ? 0.74 : 0.97}
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
                        dash={effLocked ? [7, 5] : undefined}
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
                  const effLocked = isBlueprintElementEffectivelyLocked(elements, el);
                  const interactSelect = canEdit && tool === "select" && !effLocked;
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
                      {...ez(el.id)}
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
                      listening={interactSelect}
                      draggable={interactSelect}
                      opacity={effLocked ? 0.74 : 1}
                      dash={effLocked ? [8, 5] : undefined}
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
                          if (!tryBeginShiftDuplicateDrag(el.id, e.target, e)) checkpointBlueprint();
                        }
                        if (!shiftDupSessionRef.current) initMultiDragIfNeeded(el.id);
                        if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragMove={(e) => {
                        if (!canEdit || tool !== "select") return;
                        const node = e.target;
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          applyShiftDuplicateDeltaFromNode(node);
                          return;
                        }
                        if (groupDragRef.current && groupDragRef.current.primaryId === el.id) {
                          flushMultiDragMove(el.id, node);
                        }
                      }}
                      onDragEnd={(e) => {
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          setIsDraggingSelection(false);
                          runDragScale(e.target as Konva.Line, 1);
                          replaceElements((prev) => relayoutAllDoors(prev));
                          finishShiftDuplicateDrag();
                          return;
                        }
                        setIsDraggingSelection(false);
                        const g = groupDragRef.current;
                        const wasMulti = g && g.primaryId === el.id;
                        if (wasMulti) groupDragRef.current = null;
                        const node = e.target as Konva.Line;
                        runDragScale(node, 1);
                        if (wasMulti) {
                          node.position({ x: 0, y: 0 });
                          replaceElements((prev) => syncBlueprintGroupBounds(relayoutAllDoors(prev)));
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
              {elements
                .filter((el) => el.type === "connection" && (el.path_points?.length ?? 0) >= 4)
                .map((el) => {
                  const pts = el.path_points ?? [];
                  const sel = selectedIds.includes(el.id);
                  const effLocked = isBlueprintElementEffectivelyLocked(elements, el);
                  const interactSelectEdit = canEdit && tool === "select" && !effLocked;
                  const isPlumb = el.connection_style === "plumbing";
                  const sw = isPlumb ? Math.max(1.45, 2.05 / stageScale) : Math.max(0.85, 1.28 / stageScale);
                  const stroke = sel
                    ? "rgba(251, 191, 36, 0.95)"
                    : isPlumb
                      ? "rgba(34, 211, 238, 0.9)"
                      : "rgba(226, 232, 240, 0.82)";
                  return (
                    <Line
                      key={el.id}
                      {...ez(el.id)}
                      points={pts}
                      closed={false}
                      tension={0}
                      fillEnabled={false}
                      stroke={stroke}
                      strokeWidth={sw}
                      lineCap="square"
                      lineJoin="miter"
                      perfectDrawEnabled={false}
                      listening={canEdit && tool === "select"}
                      draggable={interactSelectEdit}
                      hitStrokeWidth={Math.max(12, 16 / stageScale)}
                      onClick={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onTap={(e) => canEdit && handleSelectElementClick(e, el.id)}
                      onDragStart={(e) => {
                        if (interactSelectEdit) {
                          setIsDraggingSelection(true);
                          if (!tryBeginShiftDuplicateDrag(el.id, e.target, e)) checkpointBlueprint();
                        }
                        if (canEdit && tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragMove={(e) => {
                        if (!interactSelectEdit) return;
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          applyShiftDuplicateDeltaFromNode(e.target);
                          return;
                        }
                        batchLayer();
                      }}
                      onDragEnd={(e) => {
                        if (shiftDupSessionRef.current?.primaryOld === el.id) {
                          setIsDraggingSelection(false);
                          runDragScale(e.target as Konva.Line, 1);
                          replaceElements((prev) => relayoutAllDoors(prev));
                          finishShiftDuplicateDrag();
                          return;
                        }
                        setIsDraggingSelection(false);
                        runDragScale(e.target as Konva.Line, 1);
                        const node = e.target as Konva.Line;
                        const ox = node.x();
                        const oy = node.y();
                        node.position({ x: 0, y: 0 });
                        replaceElements((prev) =>
                          prev.map((row) => {
                            if (row.id !== el.id || row.type !== "connection" || !row.path_points || row.path_points.length < 4) {
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
                  zIndex={44_997_000}
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
                  zIndex={44_997_100}
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
                  zIndex={44_997_200}
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
              {canEdit && tool === "draw-polygon" ? (
                <Rect
                  x={-8000}
                  y={-8000}
                  width={20000}
                  height={20000}
                  fill="rgba(0,0,0,0.001)"
                  listening
                  onPointerDown={onPolygonOverlayPointerDown}
                />
              ) : null}
              {canEdit && tool === "draw-pen" ? (
                <Rect
                  x={-8000}
                  y={-8000}
                  width={20000}
                  height={20000}
                  fill="rgba(0,0,0,0.001)"
                  listening
                  onPointerDown={onPenOverlayPointerDown}
                />
              ) : null}
              {canEdit && tool === "draw-pen" && penDraft && penDraft.anchors.length > 0 ? (
                <Group listening={false}>
                  {(() => {
                    const pts0 = penDraft.anchors;
                    const flatOpen = [...pts0.flatMap((p) => [p.x, p.y])];
                    if (penHover) flatOpen.push(penHover.x, penHover.y);
                    const first = pts0[0]!;
                    const nearFirst =
                      pts0.length >= 3 &&
                      penHover &&
                      Math.hypot(penHover.x - first.x, penHover.y - first.y) <= POLY_CLOSE_PX;
                    return (
                      <>
                        <Line
                          points={flatOpen}
                          stroke="rgba(56, 189, 248, 0.75)"
                          strokeWidth={Math.max(0.85, 1.15 / stageScale)}
                          dash={[5, 4]}
                          lineCap="round"
                          listening={false}
                        />
                        {pts0.length >= 3 && penHover ? (
                          <Line
                            points={[...pts0.flatMap((p) => [p.x, p.y]), first.x, first.y]}
                            closed
                            fill="rgba(56, 189, 248, 0.06)"
                            strokeEnabled={false}
                            listening={false}
                          />
                        ) : null}
                        {pts0.map((p, i) => (
                          <Circle
                            key={`pen-${i}`}
                            x={p.x}
                            y={p.y}
                            radius={i === 0 ? (nearFirst ? 9 : 5) : 4}
                            fill={i === 0 ? "rgba(56, 189, 248, 0.4)" : "rgba(148, 163, 184, 0.35)"}
                            stroke="rgba(125, 211, 252, 0.9)"
                            strokeWidth={Math.max(1, 1.1 / stageScale)}
                            listening={false}
                          />
                        ))}
                      </>
                    );
                  })()}
                </Group>
              ) : null}
              {canEdit && tool === "draw-polygon" && polygonDraft && polygonDraft.points.length > 0 ? (
                <Group listening={false}>
                  {(() => {
                    const pts0 = polygonDraft.points;
                    const flatOpen = [...pts0.flatMap((p) => [p.x, p.y])];
                    if (polygonHover) flatOpen.push(polygonHover.x, polygonHover.y);
                    const first = pts0[0]!;
                    const nearFirst =
                      pts0.length >= 3 &&
                      polygonHover &&
                      Math.hypot(polygonHover.x - first.x, polygonHover.y - first.y) <= POLY_CLOSE_PX;
                    return (
                      <>
                        <Line
                          points={flatOpen}
                          stroke="rgba(196, 181, 253, 0.65)"
                          strokeWidth={Math.max(0.85, 1.15 / stageScale)}
                          dash={[6, 4]}
                          lineCap="round"
                          listening={false}
                        />
                        {pts0.length >= 3 && polygonHover ? (
                          <Line
                            points={[...pts0.flatMap((p) => [p.x, p.y]), first.x, first.y]}
                            closed
                            fill="rgba(167, 139, 250, 0.07)"
                            strokeEnabled={false}
                            listening={false}
                          />
                        ) : null}
                        {pts0.map((p, i) => (
                          <Circle
                            key={`pvd-${i}`}
                            x={p.x}
                            y={p.y}
                            radius={i === 0 ? (nearFirst ? 9 : 5) : 4}
                            fill={i === 0 ? "rgba(167, 139, 250, 0.45)" : "rgba(148, 163, 184, 0.35)"}
                            stroke="rgba(196, 181, 253, 0.85)"
                            strokeWidth={Math.max(1, 1.1 / stageScale)}
                            listening={false}
                          />
                        ))}
                      </>
                    );
                  })()}
                </Group>
              ) : null}
              <Transformer
                ref={transformerRef}
                zIndex={45_000_000}
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
                    blueprintSnapEnabledRef.current,
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
                    blueprintSnapEnabledRef.current,
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
        {canEdit && !isPublish ? (
          <div className="bp-float-stack">
            {tool === "draw-pen" ? (
              <div className="bp-float-context">
                <span className="bp-float-context__hint">
                  <strong className="text-ds-foreground">Pen:</strong> click for corners; press and drag for a curved
                  segment; click near the first point or press Enter to finish; double-click to finish; Esc cancels.
                </span>
              </div>
            ) : null}
            {freehandTune && selected?.type === "path" && selected.id === freehandTune.id ? (
              <div className="bp-freehand-panel">
                <span className="bp-freehand-panel__title">Stroke smoothness</span>
                <label className="bp-freehand-panel__slider-label">
                  <span className="bp-freehand-panel__hint">0 = tight · 100 = smooth</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={freehandSlider}
                    onChange={(e) => refineFreehandStroke(Number(e.target.value))}
                    aria-valuenow={freehandSlider}
                  />
                  <span className="bp-freehand-panel__value">{freehandSlider}</span>
                </label>
                <button type="button" className="bp-btn bp-btn--ghost" onClick={() => setFreehandTune(null)}>
                  Done
                </button>
              </div>
            ) : null}
            {!linkingForTaskId &&
            (selectedIds.length > 1 || selected || (tool === "place-device" && selectedIds.length === 0)) ? (
              <div className="bp-float-context">
                {tool === "place-device" && selectedIds.length === 0 ? (
                  <>
                    <span className="bp-float-context__meta">Place device</span>
                    <div className="bp-float-context__chips">
                      {(["pump", "tank", "sensor", "generic"] as DeviceKind[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          className={`bp-chip ${placeKind === k ? "is-active" : ""}`}
                          onClick={() => setPlaceKind(k)}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                    <span className="bp-float-context__hint">Click canvas to drop</span>
                  </>
                ) : null}
                {selectedIds.length > 1 ? (
                  <>
                    <span className="bp-float-context__meta">{selectedIds.length} selected</span>
                    {canGroupPick ? (
                      <button type="button" className="bp-btn" onClick={groupSelected}>
                        Group
                      </button>
                    ) : null}
                    {canConnectSelection ? (
                      <>
                        <div className="bp-float-context__chips" role="group" aria-label="Connection style">
                          <button
                            type="button"
                            className={`bp-chip ${connectStyle === "electrical" ? "is-active" : ""}`}
                            onClick={() => setConnectStyle("electrical")}
                          >
                            Electrical
                          </button>
                          <button
                            type="button"
                            className={`bp-chip ${connectStyle === "plumbing" ? "is-active" : ""}`}
                            onClick={() => setConnectStyle("plumbing")}
                          >
                            Plumbing
                          </button>
                        </div>
                        <button type="button" className="bp-btn" onClick={connectSelectedEndpoints}>
                          Connect
                        </button>
                      </>
                    ) : null}
                    {canMergeZones ? (
                      <button type="button" className="bp-btn" onClick={mergeSelectedRooms}>
                        Merge rooms
                      </button>
                    ) : null}
                    {canMergeShapes ? (
                      <button type="button" className="bp-btn" onClick={mergeSelectedShapes}>
                        Merge shapes
                      </button>
                    ) : null}
                    <button type="button" className="bp-btn bp-btn--ghost" onClick={toggleLockSelection}>
                      {selectedIds.some((id) => {
                        const row = elements.find((x) => x.id === id);
                        return row && !row.locked;
                      })
                        ? "Lock"
                        : "Unlock"}
                    </button>
                    <span className="bp-float-context__hint">
                      Shift+click / box select · Connect chains symbols/devices · Cmd+G group · Cmd+L lock
                    </span>
                  </>
                ) : selected ? (
                  <>
                    <label className="bp-float-context__compact">
                      <span>Name</span>
                      <input
                        type="text"
                        value={selected.name ?? ""}
                        onChange={(e) => updateSelectedField({ name: e.target.value })}
                        aria-label="Name"
                      />
                    </label>
                    {selected.type === "group" ? (
                      <>
                        <span className="bp-float-context__meta">
                          {selected.children?.length ?? 0} elements — Cmd+Shift+G to ungroup
                        </span>
                        <button type="button" className="bp-btn" onClick={ungroupSelected}>
                          Ungroup
                        </button>
                      </>
                    ) : null}
                    {selected.type === "connection" ? (
                      <span className="bp-float-context__meta">
                        {selected.connection_style === "plumbing" ? "Plumbing" : "Electrical"} run ·{" "}
                        {(selected.path_points?.length ?? 0) / 2} vertices
                      </span>
                    ) : null}
                    <button type="button" className="bp-btn bp-btn--ghost" onClick={toggleLockSelection}>
                      {selected.locked ? "Unlock" : "Lock"}
                    </button>
                    {selected.type === "door" ? (
                      <>
                        <label className="bp-float-context__compact">
                          <span>Door width</span>
                          <input
                            type="number"
                            min={0.1}
                            step={0.01}
                            value={Number(
                              (
                                (selected.width ?? DOOR_ALONG_DEFAULT) /
                                BP_PX_PER_M /
                                (doorWidthUnit === "ft" ? 3.280839895 : 1)
                              ).toFixed(3),
                            )}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isFinite(v) || v <= 0 || !selectedSingleId) return;
                              const pxRaw =
                                doorWidthUnit === "ft" ? (v / 3.280839895) * BP_PX_PER_M : v * BP_PX_PER_M;
                              commitElements((p) => {
                                const d = p.find((x) => x.id === selectedSingleId);
                                if (!d || d.type !== "door") return p;
                                let px = Math.max(MIN_DOOR_ALONG, pxRaw);
                                const att = parseWallAttach(d.wall_attachment);
                                const z = att ? p.find((x) => x.id === att.zoneId && x.type === "zone") : null;
                                if (att && z) px = Math.min(px, doorAlongUpperBound(z, att), MAX_DOOR_ALONG);
                                else px = Math.min(px, MAX_DOOR_ALONG);
                                const next = p.map((x) => (x.id === selectedSingleId ? { ...x, width: px } : x));
                                return next.map((x) =>
                                  x.id === selectedSingleId && x.type === "door"
                                    ? doorElementFromAttachment(x, next) ?? x
                                    : x,
                                );
                              });
                              batchLayer();
                            }}
                            aria-label="Door width"
                          />
                        </label>
                        <div className="bp-float-context__segmented" role="group" aria-label="Width unit">
                          <button
                            type="button"
                            className={doorWidthUnit === "m" ? "is-active" : ""}
                            onClick={() => setDoorWidthUnit("m")}
                          >
                            m
                          </button>
                          <button
                            type="button"
                            className={doorWidthUnit === "ft" ? "is-active" : ""}
                            onClick={() => setDoorWidthUnit("ft")}
                          >
                            ft
                          </button>
                        </div>
                        <span className="bp-float-context__hint" title={selected.wall_attachment}>
                          Wall: {selected.wall_attachment?.slice(0, 28) ?? "—"}
                          {(selected.wall_attachment?.length ?? 0) > 28 ? "…" : ""}
                        </span>
                      </>
                    ) : null}
                    {selected.type === "device" ? (
                      <>
                        <span className="bp-float-context__meta">Device</span>
                        <div className="bp-float-context__chips">
                          {(["pump", "tank", "sensor", "generic"] as DeviceKind[]).map((k) => (
                            <button
                              key={k}
                              type="button"
                              className={`bp-chip ${(selected.device_kind ?? "generic") === k ? "is-active" : ""}`}
                              onClick={() => updateSelectedField({ device_kind: k })}
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                        <select
                          aria-label="Linked equipment"
                          className="bp-float-context__select"
                          value={selected.linked_device_id ?? ""}
                          onChange={(e) =>
                            updateSelectedField({ linked_device_id: e.target.value || undefined })
                          }
                        >
                          <option value="">Equipment…</option>
                          {equipmentApi.map((eq) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.name}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Zone"
                          className="bp-float-context__select"
                          value={selected.assigned_zone_id ?? ""}
                          onChange={(e) =>
                            updateSelectedField({ assigned_zone_id: e.target.value || undefined })
                          }
                        >
                          <option value="">Zone…</option>
                          {zonesApi.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : null}
                    {selected.type === "rectangle" ? (
                      <label className="bp-float-context__compact">
                        <span>Corner radius</span>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(
                            0,
                            Math.floor(
                              Math.min(selected.width ?? MIN_ZONE, selected.height ?? MIN_ZONE) / 2,
                            ),
                          )}
                          value={Math.round(
                            clampRectCornerRadius(
                              selected.width ?? MIN_ZONE,
                              selected.height ?? MIN_ZONE,
                              selected.cornerRadius ?? 0,
                            ),
                          )}
                          onChange={(e) => {
                            const w0 = selected.width ?? MIN_ZONE;
                            const h0 = selected.height ?? MIN_ZONE;
                            updateSelectedField({
                              cornerRadius: clampRectCornerRadius(w0, h0, Number(e.target.value)),
                            });
                            batchLayer();
                          }}
                          aria-label="Corner radius"
                        />
                      </label>
                    ) : null}
                    {selected.type === "polygon" && selected.path_points ? (
                      <span className="bp-float-context__meta">
                        Polygon · {selected.path_points.length / 2} vertices · double-click or snap to first point to
                        close
                      </span>
                    ) : null}
                    {selected.type === "symbol" ? (
                      <>
                        <span className="bp-float-context__meta">({selected.symbol_type ?? "symbol"})</span>
                        <textarea
                          className="bp-float-context__textarea"
                          rows={2}
                          placeholder="Tags"
                          value={(selected.symbol_tags ?? []).join(", ")}
                          onChange={(e) =>
                            updateSelectedField({ symbol_tags: parseTagsFromInput(e.target.value) })
                          }
                          aria-label="Symbol tags"
                        />
                        <textarea
                          className="bp-float-context__textarea"
                          rows={2}
                          placeholder="Notes"
                          value={selected.symbol_notes ?? ""}
                          onChange={(e) => updateSelectedField({ symbol_notes: e.target.value || undefined })}
                          aria-label="Symbol notes"
                        />
                      </>
                    ) : null}
                    {selected.type === "path" && selected.path_points ? (
                      <span className="bp-float-context__meta">
                        {selected.path_points.length / 2} verts · bbox {Math.round(selected.width ?? 0)}×
                        {Math.round(selected.height ?? 0)}
                      </span>
                    ) : null}
                    {selected.type !== "door" && selected.type !== "path" ? (
                      <button
                        type="button"
                        className="bp-btn bp-btn--ghost"
                        disabled={!canEdit}
                        onClick={rotateSelection90Clockwise}
                      >
                        Rotate 90°
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
            <BlueprintToolRail
              layout="horizontal"
              tool={tool}
              onToolChange={(t) => {
                setTool(t);
                if (t !== "place-symbol") setSymbolPanelOpen(false);
              }}
              symbolPanelOpen={symbolPanelOpen}
              onToggleSymbolPanel={() => setSymbolPanelOpen((v) => !v)}
              disabled={!canEdit}
            />
          </div>
        ) : null}
        <BlueprintSymbolPanel
          variant="floating"
          open={symbolPanelOpen && canEdit}
          onClose={() => setSymbolPanelOpen(false)}
          activeSymbolId={placeSymbolKind}
          onSelectSymbol={(id) => {
            setPlaceSymbolKind(id);
            setTool("place-symbol");
          }}
          disabled={!canEdit}
        />
      </motion.div>
      </div>

      <motion.aside
        className={`bp-sidebar bp-sidebar--right${isPublish ? " bp-sidebar--disabled" : ""}`}
        aria-label="Blueprint layers"
        initial={false}
        animate={{ opacity: 1, x: 0 }}
        transition={bpTransition.med}
      >
        <BlueprintLayersPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onSelectLayer={(id) => setActiveLayerId(id)}
          onAddLayer={addBlueprintLayer}
          onDeleteLayer={deleteBlueprintLayer}
          onReorderLayers={reorderLayers}
          onRenameLayer={renameBlueprintLayer}
          disabled={isPublish}
        />
      </motion.aside>
    </div>
      )}
    </div>
  );
}
