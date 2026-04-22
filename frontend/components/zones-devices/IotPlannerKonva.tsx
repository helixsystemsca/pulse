"use client";

import { Circle, Group, Line } from "react-konva";
import type { Device, DeviceType, IotTool } from "./iot-deployment-types";
import { IOT_DEFAULT_METERS_PER_PIXEL } from "./iot-deployment-types";

const Z_COVERAGE = 44_990_000;
const Z_GAPS = 44_991_000;
const Z_SCALE = 44_992_000;
const Z_DEVICE = 44_993_000;

const COVERAGE_COLORS: Record<
  DeviceType,
  { inner: string; mid: string; outer: string; stroke: string; fill: string }
> = {
  node: {
    inner: "rgba(59, 130, 246, 0.24)",
    mid: "rgba(59, 130, 246, 0.14)",
    outer: "rgba(59, 130, 246, 0.02)",
    stroke: "rgba(59, 130, 246, 0.9)",
    fill: "rgba(37, 99, 235, 0.95)",
  },
  gateway: {
    inner: "rgba(34, 197, 94, 0.24)",
    mid: "rgba(34, 197, 94, 0.14)",
    outer: "rgba(34, 197, 94, 0.02)",
    stroke: "rgba(22, 163, 74, 0.95)",
    fill: "rgba(21, 128, 61, 0.95)",
  },
  lteHub: {
    inner: "rgba(168, 85, 247, 0.24)",
    mid: "rgba(168, 85, 247, 0.14)",
    outer: "rgba(168, 85, 247, 0.02)",
    stroke: "rgba(126, 34, 206, 0.95)",
    fill: "rgba(107, 33, 168, 0.95)",
  },
};

type Props = {
  devices: Device[];
  effectiveMpp: number;
  coverageEnabled: boolean;
  showGaps: boolean;
  gapPoints: { x: number; y: number }[];
  iotTool: IotTool;
  selectedId: string | null;
  hoveredId: string | null;
  scaleP1: { x: number; y: number } | null;
  scaleP2: { x: number; y: number } | null;
  canEdit: boolean;
  isPublish: boolean;
  stageScale: number;
  onSelectDevice: (id: string) => void;
  onHoverDevice: (id: string | null) => void;
  onDeviceDragEnd: (id: string, x: number, y: number) => void;
};

export function IotPlannerKonva({
  devices,
  effectiveMpp,
  coverageEnabled,
  showGaps,
  gapPoints,
  iotTool,
  selectedId,
  hoveredId,
  scaleP1,
  scaleP2,
  canEdit,
  isPublish,
  stageScale,
  onSelectDevice,
  onHoverDevice,
  onDeviceDragEnd,
}: Props) {
  const mpp = effectiveMpp > 0 ? effectiveMpp : IOT_DEFAULT_METERS_PER_PIXEL;
  const sw = Math.max(1, 1.4 / stageScale);
  const dragEnabled = canEdit && !isPublish && iotTool === "select";

  return (
    <Group listening>
      {coverageEnabled
        ? devices.map((d) => {
            const r = d.rangeMeters / mpp;
            if (!(r > 0)) return null;
            const col = COVERAGE_COLORS[d.type];
            return (
              <Circle
                key={`cov-${d.id}`}
                x={d.x}
                y={d.y}
                radius={r}
                listening={false}
                zIndex={Z_COVERAGE}
                fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                fillRadialGradientStartRadius={0}
                fillRadialGradientEndRadius={r}
                fillRadialGradientColorStops={[0, col.inner, 0.6, col.mid, 1, col.outer]}
                strokeEnabled={false}
                opacity={0.95}
              />
            );
          })
        : null}

      {coverageEnabled && showGaps
        ? gapPoints.map((p, i) => (
            <Circle
              key={`gap-${i}-${p.x.toFixed(0)}-${p.y.toFixed(0)}`}
              x={p.x}
              y={p.y}
              radius={Math.max(0.8, 1.5 / stageScale)}
              fill="rgba(248, 113, 113, 0.55)"
              stroke="rgba(220, 38, 38, 0.35)"
              strokeWidth={Math.max(0.3, 0.4 / stageScale)}
              listening={false}
              zIndex={Z_GAPS}
            />
          ))
        : null}

      {scaleP1 && scaleP2 ? (
        <Line
          points={[scaleP1.x, scaleP1.y, scaleP2.x, scaleP2.y]}
          stroke="rgba(56, 189, 248, 0.85)"
          strokeWidth={Math.max(1, 1.5 / stageScale)}
          dash={[8, 5]}
          listening={false}
          zIndex={Z_SCALE}
        />
      ) : null}
      {scaleP1 ? (
        <Circle
          x={scaleP1.x}
          y={scaleP1.y}
          radius={Math.max(4, 6 / stageScale)}
          fill="rgba(56, 189, 248, 0.4)"
          stroke="rgba(125, 211, 252, 0.9)"
          strokeWidth={sw}
          listening={false}
          zIndex={Z_SCALE + 1}
        />
      ) : null}

      {devices.map((d) => {
        const col = COVERAGE_COLORS[d.type];
        const sel = d.id === selectedId;
        const hov = d.id === hoveredId;
        return (
          <Group
            key={d.id}
            x={d.x}
            y={d.y}
            zIndex={Z_DEVICE}
            draggable={dragEnabled}
            onDragEnd={(e) => {
              const n = e.target;
              onDeviceDragEnd(d.id, n.x(), n.y());
            }}
            onMouseEnter={() => onHoverDevice(d.id)}
            onMouseLeave={() => onHoverDevice(null)}
            onClick={(e) => {
              e.cancelBubble = true;
              onSelectDevice(d.id);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onSelectDevice(d.id);
            }}
          >
            <Circle
              x={0}
              y={0}
              radius={12}
              fill={col.fill}
              stroke={sel ? "rgba(253, 224, 71, 0.95)" : hov ? "rgba(255, 255, 255, 0.85)" : col.stroke}
              strokeWidth={sel ? Math.max(2, 2.5 / stageScale) : Math.max(1.2, 1.6 / stageScale)}
              shadowColor={sel ? "rgba(250, 204, 21, 0.45)" : "rgba(0,0,0,0.2)"}
              shadowBlur={sel ? 10 : 4}
              shadowOpacity={0.8}
            />
            <Circle
              x={0}
              y={0}
              radius={4}
              fill="rgba(255,255,255,0.9)"
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
}
