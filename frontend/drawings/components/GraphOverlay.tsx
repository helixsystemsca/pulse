"use client";

import { Group, Line, Rect, Circle, Text } from "react-konva";
import type { InfraAsset, InfraConnection, SystemType, TraceRouteResult } from "../utils/graphHelpers";
import { systemColor } from "../utils/graphHelpers";

type Props = {
  assets: InfraAsset[];
  connections: InfraConnection[];
  activeSystems: Record<SystemType, boolean>;
  selectedAssetId: string | null;
  selectedConnectionId: string | null;
  hoverAssetId: string | null;
  hoverConnectionId: string | null;
  traceResult: TraceRouteResult | null;
  onHoverAssetId: (id: string | null) => void;
  onHoverConnectionId: (id: string | null) => void;
  onSelectAssetId: (id: string) => void;
  onSelectConnectionId: (id: string) => void;
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
  selectedAssetId,
  selectedConnectionId,
  hoverAssetId,
  hoverConnectionId,
  traceResult,
  onHoverAssetId,
  onHoverConnectionId,
  onSelectAssetId,
  onSelectConnectionId,
  dimNonMatching = false,
}: Props) {
  const assetsById = new Map(assets.map((a) => [a.id, a]));

  const sysOn = (s: SystemType) => activeSystems[s] !== false;

  const shouldDim = (kind: "asset" | "connection", id: string, systemType: SystemType) => {
    if (!sysOn(systemType)) return true;
    if (!dimNonMatching || !traceResult) return false;
    return !isInTrace(traceResult, kind, id);
  };

  return (
    <Group>
      {/* Connections */}
      {connections
        .filter((c) => c.active)
        .map((c) => {
          const a = assetsById.get(c.from_asset_id);
          const b = assetsById.get(c.to_asset_id);
          if (!a || !b) return null;
          const on = sysOn(c.system_type);
          const { stroke } = systemColor(c.system_type);
          const isSel = c.id === selectedConnectionId;
          const isHover = c.id === hoverConnectionId;
          const inTrace = isInTrace(traceResult, "connection", c.id);
          const dim = shouldDim("connection", c.id, c.system_type);
          const opacity = dim ? 0.12 : inTrace ? 1 : on ? 0.55 : 0.12;
          const sw = isSel || isHover || inTrace ? 4 : 2.5;
          return (
            <Line
              key={c.id}
              points={[a.x, a.y, b.x, b.y]}
              stroke={stroke}
              opacity={opacity}
              strokeWidth={sw}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={16}
              onMouseEnter={() => onHoverConnectionId(c.id)}
              onMouseLeave={() => onHoverConnectionId(null)}
              onClick={(e) => {
                e.cancelBubble = true;
                onSelectConnectionId(c.id);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onSelectConnectionId(c.id);
              }}
            />
          );
        })}

      {/* Assets */}
      {assets.map((a) => {
        const { stroke, fill } = systemColor(a.system_type);
        const isSel = a.id === selectedAssetId;
        const isHover = a.id === hoverAssetId;
        const inTrace = isInTrace(traceResult, "asset", a.id);
        const dim = shouldDim("asset", a.id, a.system_type);
        const opacity = dim ? 0.18 : inTrace ? 1 : sysOn(a.system_type) ? 0.9 : 0.18;
        const strokeWidth = isSel || isHover || inTrace ? 3.2 : 2;

        const w = 34;
        const h = 22;
        const isBuilding = a.type.toLowerCase() === "building";

        return (
          <Group
            key={a.id}
            x={a.x}
            y={a.y}
            opacity={opacity}
            onMouseEnter={() => onHoverAssetId(a.id)}
            onMouseLeave={() => onHoverAssetId(null)}
            onClick={(e) => {
              e.cancelBubble = true;
              onSelectAssetId(a.id);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onSelectAssetId(a.id);
            }}
          >
            {isBuilding ? (
              <Rect
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                cornerRadius={5}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                shadowColor="rgba(0,0,0,0.25)"
                shadowBlur={isSel ? 8 : 4}
                shadowOpacity={0.15}
              />
            ) : (
              <Circle
                radius={12}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                shadowColor="rgba(0,0,0,0.25)"
                shadowBlur={isSel ? 8 : 4}
                shadowOpacity={0.15}
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
    </Group>
  );
}

