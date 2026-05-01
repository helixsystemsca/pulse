"use client";

import type Konva from "konva";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ellipse, Group, Line, Rect } from "react-konva";
import type { InfraAsset } from "../utils/graphHelpers";
import { BUILDER_ALL_PRIMARY_MODES } from "../mapBuilderModes";
import type { AnnotateKind, AssetDrawShape, ConnectFlow, PrimaryMode } from "../mapBuilderTypes";

export type StageViewport = {
  width: number;
  height: number;
  pos: { x: number; y: number };
  scale: number;
};

function worldFromPointer(stage: Konva.Stage | null, viewport: StageViewport): { x: number; y: number } | null {
  if (!stage) return null;
  const p = stage.getPointerPosition();
  if (!p) return null;
  return { x: (p.x - viewport.pos.x) / viewport.scale, y: (p.y - viewport.pos.y) / viewport.scale };
}

function nearestAssetWithin(assets: InfraAsset[], x: number, y: number, maxWorld: number): string | null {
  const max2 = maxWorld * maxWorld;
  let best: { id: string; d2: number } | null = null;
  for (const a of assets) {
    const dx = a.x - x;
    const dy = a.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= max2 && (!best || d2 < best.d2)) best = { id: a.id, d2 };
  }
  return best?.id ?? null;
}

function centroid(flat: number[]): { x: number; y: number } {
  const n = flat.length / 2;
  if (n <= 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < flat.length; i += 2) {
    sx += flat[i]!;
    sy += flat[i + 1]!;
  }
  return { x: sx / n, y: sy / n };
}

type Props = {
  viewport: StageViewport | null;
  assets: InfraAsset[];
  disabled?: boolean;
  primaryMode: PrimaryMode;
  assetShape: AssetDrawShape;
  connectFlow: ConnectFlow;
  annotateKind: AnnotateKind;
  /** Asset placement — creates DB asset + blueprint footprint. */
  onSemanticAssetShape: (payload: {
    shape: AssetDrawShape;
    blueprint: {
      type: "rectangle" | "ellipse" | "polygon";
      x: number;
      y: number;
      width?: number;
      height?: number;
      path_points?: number[];
      name: string;
      symbol_notes?: string;
    };
    assetCenter: { x: number; y: number };
    assetDefaults: { type: string; system_type: InfraAsset["system_type"]; name: string };
  }) => void | Promise<void>;
  /** Connection from drawn segment (endpoints snap to assets). */
  onSemanticConnectionDraw: (fromAssetId: string, toAssetId: string) => void | Promise<void>;
  /** Zone polygon (blueprint only, non-graph). */
  onSemanticZonePolygon: (path_points: number[], label: string) => void | Promise<void>;
  /** Annotate: blueprint-only overlay. */
  onSemanticAnnotateSymbol: (x: number, y: number) => void | Promise<void>;
  /** Text label overlay (wider symbol plate). */
  onSemanticAnnotateText: (x: number, y: number) => void | Promise<void>;
  /** Closed region sketch (tap vertices). */
  onSemanticAnnotateSketch: (path_points: number[]) => void | Promise<void>;
  /** Freehand stroke (open path). */
  onSemanticAnnotatePen: (path_points: number[]) => void | Promise<void>;
  /** Max distance (world px) to attach drawn connection endpoints to assets — from active mode config. */
  drawConnectionSnapRadiusWorld?: number;
  allowedPrimaryModes?: ReadonlySet<PrimaryMode>;
  allowedAnnotateKinds?: ReadonlySet<AnnotateKind>;
};

const MIN_DRAG_WORLD = 6;
const CLOSE_POLY_WORLD = 14;
const DEFAULT_SNAP_WORLD = 52;
const SYMBOL_W = 40;
const MIN_PEN_STEP_WORLD = 3;
const MIN_PEN_POINTS = 4;

export function MapSemanticDrawLayer({
  viewport,
  assets,
  disabled,
  primaryMode,
  assetShape,
  connectFlow,
  annotateKind,
  onSemanticAssetShape,
  onSemanticConnectionDraw,
  onSemanticZonePolygon,
  onSemanticAnnotateSymbol,
  onSemanticAnnotateText,
  onSemanticAnnotateSketch,
  onSemanticAnnotatePen,
  drawConnectionSnapRadiusWorld = DEFAULT_SNAP_WORLD,
  allowedPrimaryModes = BUILDER_ALL_PRIMARY_MODES,
  allowedAnnotateKinds,
}: Props) {
  const dragRectRef = useRef<{ x0: number; y0: number } | null>(null);
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [polyPts, setPolyPts] = useState<number[]>([]);
  const connectDragRef = useRef<{ x0: number; y0: number } | null>(null);
  const [connectDrag, setConnectDrag] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const penDragRef = useRef<number[] | null>(null);
  const [penPreview, setPenPreview] = useState<number[] | null>(null);

  const listening = Boolean(viewport) && !disabled;

  const annotateAllowed = allowedAnnotateKinds?.has(annotateKind) ?? true;

  const captureActive = useMemo(() => {
    if (!listening || !viewport) return false;
    if (!allowedPrimaryModes.has(primaryMode)) return false;
    if (primaryMode === "select") return false;
    if (primaryMode === "connect" && connectFlow === "pick") return false;
    if (primaryMode === "annotate" && !annotateAllowed) return false;
    return true;
  }, [allowedPrimaryModes, annotateAllowed, connectFlow, listening, primaryMode, viewport]);

  const resetDraft = useCallback(() => {
    dragRectRef.current = null;
    setDragRect(null);
    setPolyPts([]);
    connectDragRef.current = null;
    setConnectDrag(null);
    penDragRef.current = null;
    setPenPreview(null);
  }, []);

  useEffect(() => {
    resetDraft();
  }, [annotateKind, assetShape, connectFlow, primaryMode, resetDraft]);

  const worldBounds = useMemo(() => {
    if (!viewport) return null;
    return {
      x: (-viewport.pos.x) / viewport.scale,
      y: (-viewport.pos.y) / viewport.scale,
      w: viewport.width / viewport.scale,
      h: viewport.height / viewport.scale,
    };
  }, [viewport]);

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!viewport || !worldBounds || disabled) return;
      const w = worldFromPointer(e.target.getStage(), viewport);
      if (!w) return;

      if (!allowedPrimaryModes.has(primaryMode)) return;
      if (primaryMode === "annotate" && allowedAnnotateKinds && !allowedAnnotateKinds.has(annotateKind)) return;

      if (primaryMode === "annotate" && annotateKind === "symbol") {
        e.cancelBubble = true;
        void onSemanticAnnotateSymbol(w.x - SYMBOL_W / 2, w.y - SYMBOL_W / 2);
        return;
      }

      if (primaryMode === "annotate" && annotateKind === "text") {
        e.cancelBubble = true;
        void onSemanticAnnotateText(w.x, w.y);
        return;
      }

      if (primaryMode === "annotate" && annotateKind === "pen") {
        e.cancelBubble = true;
        penDragRef.current = [w.x, w.y];
        setPenPreview([w.x, w.y]);
        return;
      }

      if (primaryMode === "connect" && connectFlow === "draw") {
        e.cancelBubble = true;
        connectDragRef.current = { x0: w.x, y0: w.y };
        setConnectDrag({ x: w.x, y: w.y, x2: w.x, y2: w.y });
        return;
      }

      if (primaryMode === "add_asset") {
        if (assetShape === "rectangle" || assetShape === "ellipse") {
          e.cancelBubble = true;
          dragRectRef.current = { x0: w.x, y0: w.y };
          setDragRect({ x: w.x, y: w.y, w: 0, h: 0 });
          return;
        }
        if (assetShape === "polygon") {
          e.cancelBubble = true;
          setPolyPts((prev) => {
            if (prev.length >= 6) {
              const fx = prev[0]!;
              const fy = prev[1]!;
              if (Math.hypot(w.x - fx, w.y - fy) <= CLOSE_POLY_WORLD) {
                const pts = [...prev];
                void onSemanticAssetShape({
                  shape: "polygon",
                  blueprint: {
                    type: "polygon",
                    x: pts[0]!,
                    y: pts[1]!,
                    path_points: pts,
                    name: "Area asset",
                  },
                  assetCenter: centroid(pts),
                  assetDefaults: { type: "area", system_type: "telemetry", name: "Area" },
                });
                return [];
              }
            }
            return [...prev, w.x, w.y];
          });
          return;
        }
      }

      if (primaryMode === "add_zone") {
        e.cancelBubble = true;
        setPolyPts((prev) => {
          if (prev.length >= 6) {
            const fx = prev[0]!;
            const fy = prev[1]!;
            if (Math.hypot(w.x - fx, w.y - fy) <= CLOSE_POLY_WORLD) {
              const pts = [...prev];
              void onSemanticZonePolygon(pts, "Zone");
              return [];
            }
          }
          return [...prev, w.x, w.y];
        });
        return;
      }

      if (primaryMode === "annotate" && annotateKind === "sketch") {
        e.cancelBubble = true;
        setPolyPts((prev) => {
          if (prev.length >= 6) {
            const fx = prev[0]!;
            const fy = prev[1]!;
            if (Math.hypot(w.x - fx, w.y - fy) <= CLOSE_POLY_WORLD) {
              const pts = [...prev];
              void onSemanticAnnotateSketch(pts);
              return [];
            }
          }
          return [...prev, w.x, w.y];
        });
      }
    },
    [
      allowedAnnotateKinds,
      allowedPrimaryModes,
      annotateKind,
      assetShape,
      connectFlow,
      disabled,
      onSemanticAnnotateSketch,
      onSemanticAnnotateSymbol,
      onSemanticAnnotateText,
      onSemanticAnnotatePen,
      onSemanticAssetShape,
      onSemanticZonePolygon,
      primaryMode,
      viewport,
      worldBounds,
    ],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!viewport || disabled) return;
      const w = worldFromPointer(e.target.getStage(), viewport);
      if (!w) return;

      if (primaryMode === "connect" && connectFlow === "draw" && connectDragRef.current) {
        const o = connectDragRef.current;
        setConnectDrag({ x: o.x0, y: o.y0, x2: w.x, y2: w.y });
        return;
      }

      if (primaryMode === "annotate" && annotateKind === "pen" && penDragRef.current) {
        const pts = penDragRef.current;
        const lx = pts[pts.length - 2]!;
        const ly = pts[pts.length - 1]!;
        if (Math.hypot(w.x - lx, w.y - ly) >= MIN_PEN_STEP_WORLD) {
          penDragRef.current = [...pts, w.x, w.y];
          setPenPreview([...penDragRef.current]);
        }
        return;
      }

      if (primaryMode === "add_asset" && (assetShape === "rectangle" || assetShape === "ellipse")) {
        const d0 = dragRectRef.current;
        if (d0) {
          const x = Math.min(d0.x0, w.x);
          const y = Math.min(d0.y0, w.y);
          const rw = Math.abs(w.x - d0.x0);
          const rh = Math.abs(w.y - d0.y0);
          setDragRect({ x, y, w: rw, h: rh });
        }
      }
    },
    [annotateKind, assetShape, connectFlow, disabled, primaryMode, viewport],
  );

  const handleMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!viewport || disabled) return;
      const w = worldFromPointer(e.target.getStage(), viewport);
      if (!w) return;

      if (primaryMode === "connect" && connectFlow === "draw" && connectDragRef.current) {
        e.cancelBubble = true;
        const o = connectDragRef.current;
        const snapR = drawConnectionSnapRadiusWorld;
        const fromId = nearestAssetWithin(assets, o.x0, o.y0, snapR);
        const toId = nearestAssetWithin(assets, w.x, w.y, snapR);
        connectDragRef.current = null;
        setConnectDrag(null);
        if (fromId && toId && fromId !== toId) {
          void onSemanticConnectionDraw(fromId, toId);
        }
        return;
      }

      if (primaryMode === "annotate" && annotateKind === "pen" && penDragRef.current) {
        e.cancelBubble = true;
        const pts = penDragRef.current;
        penDragRef.current = null;
        setPenPreview(null);
        if (pts.length >= MIN_PEN_POINTS) {
          void onSemanticAnnotatePen(pts);
        }
        return;
      }

      if (primaryMode === "add_asset" && (assetShape === "rectangle" || assetShape === "ellipse") && dragRectRef.current) {
        e.cancelBubble = true;
        const d0 = dragRectRef.current;
        const x = Math.min(d0.x0, w.x);
        const y = Math.min(d0.y0, w.y);
        const rw = Math.abs(w.x - d0.x0);
        const rh = Math.abs(w.y - d0.y0);
        dragRectRef.current = null;
        setDragRect(null);
        if (rw < MIN_DRAG_WORLD || rh < MIN_DRAG_WORLD) return;

        const cx = x + rw / 2;
        const cy = y + rh / 2;
        if (assetShape === "rectangle") {
          void onSemanticAssetShape({
            shape: "rectangle",
            blueprint: {
              type: "rectangle",
              x,
              y,
              width: rw,
              height: rh,
              name: "Building",
            },
            assetCenter: { x: cx, y: cy },
            assetDefaults: { type: "building", system_type: "telemetry", name: "Building" },
          });
        } else {
          void onSemanticAssetShape({
            shape: "ellipse",
            blueprint: {
              type: "ellipse",
              x,
              y,
              width: rw,
              height: rh,
              name: "Node",
            },
            assetCenter: { x: cx, y: cy },
            assetDefaults: { type: "junction", system_type: "telemetry", name: "Node" },
          });
        }
      }
    },
    [
      annotateKind,
      assetShape,
      connectFlow,
      disabled,
      onSemanticAnnotatePen,
      onSemanticAssetShape,
      onSemanticConnectionDraw,
      assets,
      primaryMode,
      viewport,
      drawConnectionSnapRadiusWorld,
    ],
  );

  if (!worldBounds) return null;

  const polyPreview =
    polyPts.length >= 4 ? (
      <Line
        points={polyPts}
        stroke="rgba(59, 130, 246, 0.85)"
        strokeWidth={2}
        dash={[8, 6]}
        closed={false}
        listening={false}
      />
    ) : null;

  const rectPreview =
    dragRect && dragRect.w > 1 && dragRect.h > 1 ? (
      primaryMode === "add_asset" && assetShape === "ellipse" ? (
        <Ellipse
          x={dragRect.x + dragRect.w / 2}
          y={dragRect.y + dragRect.h / 2}
          radiusX={Math.max(2, dragRect.w / 2)}
          radiusY={Math.max(2, dragRect.h / 2)}
          stroke="rgba(14, 165, 233, 0.75)"
          strokeWidth={2}
          dash={[10, 8]}
          listening={false}
        />
      ) : (
        <Rect
          x={dragRect.x}
          y={dragRect.y}
          width={dragRect.w}
          height={dragRect.h}
          stroke="rgba(59, 130, 246, 0.75)"
          strokeWidth={2}
          dash={[10, 8]}
          listening={false}
        />
      )
    ) : null;

  const connectPreview =
    connectDrag && primaryMode === "connect" && connectFlow === "draw" ? (
      <Line
        points={[connectDrag.x, connectDrag.y, connectDrag.x2, connectDrag.y2]}
        stroke="rgba(34, 197, 94, 0.85)"
        strokeWidth={2.5}
        dash={[12, 8]}
        listening={false}
      />
    ) : null;

  const penStrokePreview =
    penPreview && penPreview.length >= 4 ? (
      <Line
        points={penPreview}
        stroke="rgba(148, 163, 184, 0.95)"
        strokeWidth={2}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    ) : null;

  return (
    <Group listening={captureActive}>
      <Rect
        x={worldBounds.x}
        y={worldBounds.y}
        width={worldBounds.w}
        height={worldBounds.h}
        fill="transparent"
        listening={captureActive}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      {rectPreview}
      {connectPreview}
      {(primaryMode === "add_asset" && assetShape === "polygon") ||
      primaryMode === "add_zone" ||
      (primaryMode === "annotate" && annotateKind === "sketch")
        ? polyPreview
        : null}
      {primaryMode === "annotate" && annotateKind === "pen" ? penStrokePreview : null}
    </Group>
  );
}
