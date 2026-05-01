"use client";

import type Konva from "konva";
import { Group, Line, Rect, Circle, Text } from "react-konva";
import { useEffect, useMemo, useRef } from "react";
import type { InfraAsset, InfraConnection, SystemType, TraceRouteResult } from "../utils/graphHelpers";
import { systemColor } from "../utils/graphHelpers";

type Props = {
  assets: InfraAsset[];
  connections: InfraConnection[];
  activeSystems: Record<SystemType, boolean>;
  selectedAssets: string[];
  selectedConnections: string[];
  hoverAssetId: string | null;
  hoverConnectionId: string | null;
  traceResult: TraceRouteResult | null;
  connectMode: boolean;
  connectStartAssetId: string | null;
  pointerWorldRef: React.MutableRefObject<{ x: number; y: number } | null>;
  stageScaleRef: React.MutableRefObject<number>;
  onHoverAssetId: (id: string | null) => void;
  onHoverConnectionId: (id: string | null) => void;
  onSelectAssetId: (id: string, shiftKey: boolean) => void;
  onSelectConnectionId: (id: string, shiftKey: boolean) => void;
  onAssetDragMove?: (id: string, x: number, y: number) => void;
  onAssetDragEnd?: (id: string, x: number, y: number) => void;
  draggableAssets?: boolean;
  /**
   * When connect mode is active, clicks are routed to the parent (still select asset id),
   * but we draw a preview line externally.
   */
  dimNonMatching?: boolean;
};

function isInTrace(trace: TraceRouteResult | null, kind: "asset" | "connection", id: string): boolean {
  if (!trace) return false;
  return kind === "asset" ? trace.asset_ids.includes(id) : trace.connection_ids.includes(id);
}

export function GraphOverlay({
  assets,
  connections,
  activeSystems,
  selectedAssets,
  selectedConnections,
  hoverAssetId,
  hoverConnectionId,
  traceResult,
  connectMode,
  connectStartAssetId,
  pointerWorldRef,
  stageScaleRef,
  onHoverAssetId,
  onHoverConnectionId,
  onSelectAssetId,
  onSelectConnectionId,
  onAssetDragMove,
  onAssetDragEnd,
  draggableAssets = true,
  dimNonMatching = false,
}: Props) {
  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const selectedAssetSet = new Set(selectedAssets);
  const selectedConnSet = new Set(selectedConnections);

  const sysOn = (s: SystemType) => activeSystems[s] !== false;

  const shouldDim = (kind: "asset" | "connection", id: string, systemType: SystemType) => {
    if (!sysOn(systemType)) return true;
    if (!dimNonMatching || !traceResult) return false;
    return !isInTrace(traceResult, kind, id);
  };

  // Precompute connection endpoints; recompute only when assets/connections change.
  const connectionPoints = useMemo(() => {
    const m = new Map<string, [number, number, number, number]>();
    for (const c of connections) {
      if (!c.active) continue;
      const a = assetsById.get(c.from_asset_id);
      const b = assetsById.get(c.to_asset_id);
      if (!a || !b) continue;
      m.set(c.id, [a.x, a.y, b.x, b.y]);
    }
    return m;
  }, [assetsById, connections]);

  // Multi-select bounds (assets only).
  const multiBounds = useMemo(() => {
    if (selectedAssets.length < 2) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of selectedAssets) {
      const a = assetsById.get(id);
      if (!a) continue;
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x);
      maxY = Math.max(maxY, a.y);
    }
    if (!Number.isFinite(minX)) return null;
    const pad = 18;
    return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 };
  }, [assetsById, selectedAssets]);

  const snapTargetIdRef = useRef<string | null>(null);

  // Imperative connect preview line (RAF loop, no setState).
  const previewLineRef = useRef<Konva.Line | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const stop = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const line = previewLineRef.current;
      if (line) {
        line.visible(false);
        line.getLayer()?.batchDraw();
      }
    };

    if (!connectMode || !connectStartAssetId) {
      stop();
      return;
    }

    const line = previewLineRef.current;
    if (line) line.visible(true);

    const SNAP_SCREEN_PX = 14;
    const MIN_WORLD = 2;
    const MAX_WORLD = 50;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const l = previewLineRef.current;
      if (!l) return;
      const from = assetsById.get(connectStartAssetId);
      const p = pointerWorldRef.current;
      if (!from || !p) return;

      // Snap pointer to nearby asset center (excluding start asset).
      let tx = p.x;
      let ty = p.y;
      const rawScale = stageScaleRef.current;
      const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
      const snapThresholdWorld = Math.min(MAX_WORLD, Math.max(MIN_WORLD, SNAP_SCREEN_PX / scale));
      let bestD2 = snapThresholdWorld * snapThresholdWorld;
      let snapId: string | null = null;
      for (const a of assets) {
        if (a.id === connectStartAssetId) continue;
        const dx = a.x - p.x;
        const dy = a.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2) {
          bestD2 = d2;
          tx = a.x;
          ty = a.y;
          snapId = a.id;
        }
      }
      snapTargetIdRef.current = snapId;

      l.points([from.x, from.y, tx, ty]);
      l.getLayer()?.batchDraw();
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => stop();
  }, [assets, assetsById, connectMode, connectStartAssetId, pointerWorldRef]);

  return (
    <Group>
      {/* Imperative connect preview line (points updated via RAF) */}
      <Line
        ref={(n) => {
          previewLineRef.current = n;
        }}
        points={[0, 0, 0, 0]}
        stroke="rgba(59, 130, 246, 0.75)"
        opacity={0.55}
        strokeWidth={3}
        dash={[10, 8]}
        lineCap="round"
        lineJoin="round"
        listening={false}
        visible={Boolean(connectMode && connectStartAssetId)}
      />

      {/* Connections */}
      {connections
        .filter((c) => c.active)
        .map((c) => {
          const pts = connectionPoints.get(c.id);
          if (!pts) return null;
          const on = sysOn(c.system_type);
          const { stroke } = systemColor(c.system_type);
          const isSel = selectedConnSet.has(c.id);
          const isHover = c.id === hoverConnectionId;
          const inTrace = isInTrace(traceResult, "connection", c.id);
          const dim = shouldDim("connection", c.id, c.system_type);
          const opacity = dim ? 0.1 : inTrace ? 1 : on ? 0.55 : 0.1;
          const sw = inTrace ? 6 : isSel ? 5 : isHover ? 4 : 2.5;
          return (
            <Group key={c.id}>
              {/* Invisible hit target for easier selection */}
              <Line
                points={[pts[0], pts[1], pts[2], pts[3]]}
                stroke="rgba(0,0,0,1)"
                opacity={0}
                strokeWidth={14}
                lineCap="round"
                lineJoin="round"
                onMouseEnter={() => onHoverConnectionId(c.id)}
                onMouseLeave={() => onHoverConnectionId(null)}
                onClick={(e) => {
                  e.cancelBubble = true;
                  onSelectConnectionId(c.id, Boolean((e.evt as MouseEvent | undefined)?.shiftKey));
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  onSelectConnectionId(c.id, false);
                }}
              />
              {/* Visible connection */}
              <Line
                points={[pts[0], pts[1], pts[2], pts[3]]}
                stroke={stroke}
                opacity={opacity}
                strokeWidth={sw}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            </Group>
          );
        })}

      {/* Assets */}
      {assets.map((a) => {
        const { stroke, fill } = systemColor(a.system_type);
        const isSel = selectedAssetSet.has(a.id);
        const isHover = a.id === hoverAssetId;
        const inTrace = isInTrace(traceResult, "asset", a.id);
        const dim = shouldDim("asset", a.id, a.system_type);
        const opacity = dim ? 0.15 : inTrace ? 1 : sysOn(a.system_type) ? 0.92 : 0.15;
        const strokeWidth = inTrace ? 4.2 : isSel ? 3.6 : isHover ? 3 : 2;
        const glow = inTrace ? 10 : isSel ? 9 : isHover ? 7 : 4;

        const w = 30;
        const h = 20;
        const isBuilding = a.type.toLowerCase() === "building";
        const isSnapTarget = connectMode && snapTargetIdRef.current === a.id;
        const snapBoost = isSnapTarget ? 1.25 : 1;

        return (
          <Group
            key={a.id}
            x={a.x}
            y={a.y}
            opacity={opacity}
            draggable={draggableAssets && !connectMode}
            onDragMove={(e) => {
              const nx = e.target.x();
              const ny = e.target.y();
              onAssetDragMove?.(a.id, nx, ny);
            }}
            onDragEnd={(e) => {
              const nx = e.target.x();
              const ny = e.target.y();
              onAssetDragEnd?.(a.id, nx, ny);
            }}
            onMouseEnter={() => onHoverAssetId(a.id)}
            onMouseLeave={() => onHoverAssetId(null)}
            onClick={(e) => {
              e.cancelBubble = true;
              onSelectAssetId(a.id, Boolean((e.evt as MouseEvent | undefined)?.shiftKey));
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onSelectAssetId(a.id, false);
            }}
          >
            {isBuilding ? (
              <Rect
                x={-(w * snapBoost) / 2}
                y={-(h * snapBoost) / 2}
                width={w * snapBoost}
                height={h * snapBoost}
                cornerRadius={5}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSnapTarget ? strokeWidth + 1 : strokeWidth}
                shadowColor="rgba(0,0,0,0.25)"
                shadowBlur={glow}
                shadowOpacity={inTrace ? 0.28 : isSel ? 0.22 : 0.15}
              />
            ) : (
              <Circle
                radius={11 * snapBoost}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSnapTarget ? strokeWidth + 1 : strokeWidth}
                shadowColor="rgba(0,0,0,0.25)"
                shadowBlur={glow}
                shadowOpacity={inTrace ? 0.28 : isSel ? 0.22 : 0.15}
              />
            )}
            <Text
              text={(a.name || "ASSET").slice(0, 14)}
              x={-50}
              y={16}
              width={100}
              align="center"
              fontSize={10}
              fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
              fill="rgba(15, 23, 42, 0.9)"
              opacity={0.85}
              listening={false}
            />
          </Group>
        );
      })}

      {/* Multi-select bounds */}
      {multiBounds ? (
        <Rect
          x={multiBounds.x}
          y={multiBounds.y}
          width={multiBounds.w}
          height={multiBounds.h}
          stroke="rgba(59, 130, 246, 0.9)"
          strokeWidth={2}
          dash={[10, 6]}
          cornerRadius={8}
          listening={false}
          opacity={0.9}
        />
      ) : null}
    </Group>
  );
}

