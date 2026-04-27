"use client";

/**
 * Read-only Konva preview for tenant blueprints (e.g. Floor Plans page).
 * Colors follow `theme` so light/dark match the Pulse shell.
 */

import type Konva from "konva";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Circle, Ellipse, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { isRoom, type BlueprintElement, type BlueprintLayer } from "./blueprint-types";
import {
  bboxFromPathPoints,
  blueprintPaintZIndices,
  DOOR_ALONG_DEFAULT,
  DOOR_DEPTH_DEFAULT,
  DEVICE_DEFAULT,
  GRID,
  PATH_LINE_TENSION,
  relayoutAllDoors,
  SYMBOL_DEFAULT,
  SYMBOL_ICON_Y_NUDGE,
  SYMBOL_LABEL_BAND_GAP,
  unionBlueprintElementsBounds,
  ZONE_RADIUS,
  zonePolygonFlat,
} from "@/lib/blueprint-layout";

export type BlueprintReadOnlyTheme = "light" | "dark";

function clampRectCornerRadiusRo(w: number, h: number, r: number): number {
  const m = Math.min(w, h) / 2;
  return Math.max(0, Math.min(r, m));
}

function wallDropOffset(deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = 2.6 * Math.cos(rad) - 3.8 * Math.sin(rad);
  const dy = 2.6 * Math.sin(rad) + 3.8 * Math.cos(rad);
  return { dx, dy };
}

function mockLinkStatus(linkedId: string | undefined): "neutral" | "normal" | "warning" | "alarm" {
  if (!linkedId) return "neutral";
  const n = linkedId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const m = n % 4;
  if (m === 0) return "normal";
  if (m === 1) return "warning";
  return "alarm";
}

const STATUS_STROKE: Record<string, string> = {
  neutral: "rgba(100, 116, 139, 0.75)",
  normal: "rgba(34, 197, 94, 0.75)",
  warning: "rgba(217, 119, 6, 0.8)",
  alarm: "rgba(220, 38, 38, 0.8)",
};

const STATUS_SOFT_FILL: Record<string, string> = {
  neutral: "rgba(100, 116, 139, 0.08)",
  normal: "rgba(34, 197, 94, 0.1)",
  warning: "rgba(217, 119, 6, 0.1)",
  alarm: "rgba(220, 38, 38, 0.09)",
};

function DeviceGlyphRo({ kind, statusKey, strokeScale }: { kind: string; statusKey: string; strokeScale: number }) {
  const stroke = STATUS_STROKE[statusKey] ?? STATUS_STROKE.neutral;
  const soft = STATUS_SOFT_FILL[statusKey] ?? STATUS_SOFT_FILL.neutral;
  const swm = 1.35 * strokeScale;
  const r = 14;

  switch (kind) {
    case "pump":
      return (
        <Group listening={false}>
          <Circle radius={r} fill={soft} stroke={stroke} strokeWidth={swm} />
          <Rect x={-2.5} y={-r - 7} width={5} height={7} cornerRadius={1} fill="transparent" stroke={stroke} strokeWidth={swm * 0.9} />
          <Line points={[-5, r * 0.35, 5, r * 0.35]} stroke={stroke} strokeWidth={swm * 0.85} listening={false} />
        </Group>
      );
    case "tank":
      return (
        <Rect x={-r} y={-r + 1} width={r * 2} height={r * 2 - 2} cornerRadius={5} fill={soft} stroke={stroke} strokeWidth={swm} listening={false} />
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

const SYM_STROKE_LIGHT = "rgba(30, 41, 59, 0.65)";
const SYM_STROKE_DARK = "rgba(226, 232, 240, 0.88)";
const SYM_FILL_LIGHT = "rgba(59, 130, 246, 0.16)";
const SYM_FILL_DARK = "rgba(56, 189, 248, 0.14)";
const SYM_FILL2_LIGHT = "rgba(34, 197, 94, 0.14)";
const SYM_FILL2_DARK = "rgba(34, 197, 94, 0.12)";

function SymbolGlyphRo({ symbolType, isDark }: { symbolType: string; isDark: boolean }) {
  const k = symbolType.toLowerCase();
  const stroke = isDark ? SYM_STROKE_DARK : SYM_STROKE_LIGHT;
  const fill = isDark ? SYM_FILL_DARK : SYM_FILL_LIGHT;
  const fill2 = isDark ? SYM_FILL2_DARK : SYM_FILL2_LIGHT;
  const sw = 1.25;
  switch (k) {
    case "tree":
      return (
        <Group listening={false}>
          <Rect x={-2} y={4} width={4} height={10} fill="rgba(120, 83, 58, 0.65)" cornerRadius={1} listening={false} />
          <Circle x={0} y={-2} radius={11} fill={fill2} stroke={stroke} strokeWidth={sw} listening={false} />
          <Circle x={-5} y={2} radius={6} fill={fill2} stroke={stroke} strokeWidth={sw * 0.85} listening={false} />
          <Circle x={6} y={1} radius={5} fill={fill2} stroke={stroke} strokeWidth={sw * 0.85} listening={false} />
        </Group>
      );
    case "sprinkler":
      return (
        <Group listening={false}>
          <Circle radius={9} fill={fill} stroke={stroke} strokeWidth={sw} listening={false} />
          <Line points={[0, -9, 0, -16]} stroke={stroke} strokeWidth={sw} listening={false} />
          <Line points={[-10, -12, 10, -12]} stroke={stroke} strokeWidth={sw * 0.9} listening={false} />
        </Group>
      );
    case "valve":
      return (
        <Group listening={false}>
          <Rect x={-10} y={-3} width={20} height={6} fill={fill} stroke={stroke} strokeWidth={sw} cornerRadius={2} listening={false} />
          <Rect x={-3} y={-12} width={6} height={22} fill={fill} stroke={stroke} strokeWidth={sw} cornerRadius={2} listening={false} />
        </Group>
      );
    default:
      return (
        <Group listening={false}>
          <Circle radius={10} fill={fill} stroke={stroke} strokeWidth={sw} listening={false} />
          <Line points={[-5, -2, 5, -2]} stroke={stroke} strokeWidth={sw} listening={false} />
        </Group>
      );
  }
}

function palette(theme: BlueprintReadOnlyTheme) {
  if (theme === "dark") {
    return {
      canvasBg: "#354766",
      grid: "rgba(148, 163, 184, 0.07)",
      zoneFill: "rgba(248, 250, 252, 0.038)",
      zoneStroke: "rgba(229, 231, 235, 0.88)",
      zoneLabel: "#cbd5f5",
      zoneShadow: "rgba(0, 0, 0, 0.2)",
      pathFill: "rgba(56, 189, 248, 0.08)",
      pathStroke: "rgba(148, 197, 255, 0.52)",
      doorFill: "rgba(53, 71, 102, 0.22)",
      doorStroke: "rgba(148, 163, 184, 0.45)",
      doorCut: "#354766",
      symbolPlate: "rgba(53, 71, 102, 0.16)",
      devicePlate: "rgba(53, 71, 102, 0.2)",
      deviceStroke: "rgba(203, 213, 245, 0.16)",
      label: "#cbd5f5",
      mass: "rgba(44, 58, 85, 0.58)",
    };
  }
  return {
    canvasBg: "#f1f5f9",
    grid: "rgba(15, 23, 42, 0.07)",
    zoneFill: "rgba(59, 130, 246, 0.06)",
    zoneStroke: "rgba(51, 65, 85, 0.38)",
    zoneLabel: "#334155",
    zoneShadow: "rgba(15, 23, 42, 0.08)",
    pathFill: "rgba(59, 130, 246, 0.12)",
    pathStroke: "rgba(37, 99, 235, 0.5)",
    doorFill: "rgba(255, 255, 255, 0.92)",
    doorStroke: "rgba(71, 85, 105, 0.45)",
    doorCut: "#f1f5f9",
    symbolPlate: "rgba(255, 255, 255, 0.95)",
    devicePlate: "rgba(255, 255, 255, 0.96)",
    deviceStroke: "rgba(100, 116, 139, 0.35)",
    label: "#475569",
    mass: "rgba(15, 23, 42, 0.12)",
  };
}

export type BlueprintReadOnlyCanvasProps = {
  elements: BlueprintElement[];
  /** When set, element `layer_id` controls paint order (top-first list). */
  layers?: BlueprintLayer[];
  theme: BlueprintReadOnlyTheme;
  /** Min height of the preview region */
  minHeight?: number;
  onSelectElementId?: (id: string) => void;
  /**
   * When this value changes (e.g. selected blueprint id), the view is auto-fitted again
   * and any manual zoom from the wheel is cleared.
   */
  fitResetKey?: string;
};

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.75;

export function BlueprintReadOnlyCanvas({
  elements,
  layers = [],
  theme: themeName,
  minHeight = 420,
  onSelectElementId,
  fitResetKey,
}: BlueprintReadOnlyCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const userAdjustedRef = useRef(false);
  const prevFitKeyRef = useRef<string | undefined>(undefined);
  const [size, setSize] = useState({ w: 320, h: minHeight });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const laidOut = useMemo(() => relayoutAllDoors(elements), [elements]);
  const theme = useMemo(() => palette(themeName), [themeName]);
  const elementZ = useMemo(() => blueprintPaintZIndices(laidOut, layers), [laidOut, layers]);
  const ez = (elementId: string) => {
    const z = elementZ.get(elementId);
    return z === undefined ? {} : { zIndex: z };
  };

  const fitView = useCallback(
    (stageW: number, stageH: number, els: BlueprintElement[]) => {
      const b = unionBlueprintElementsBounds(els);
      const pad = 56;
      if (!b) {
        setScale(1);
        setPos({ x: pad, y: pad });
        return;
      }
      const bw = Math.max(40, b.R - b.L);
      const bh = Math.max(40, b.B - b.T);
      const sx = (stageW - pad * 2) / bw;
      const sy = (stageH - pad * 2) / bh;
      const s = Math.min(sx, sy, ZOOM_MAX);
      const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s));
      const cx = (b.L + b.R) / 2;
      const cy = (b.T + b.B) / 2;
      setScale(clamped);
      setPos({ x: stageW / 2 - cx * clamped, y: stageH / 2 - cy * clamped });
    },
    [],
  );

  /** Width from layout only; height stays `minHeight` to avoid ResizeObserver ↔ canvas size feedback loops. */
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const measure = () => {
      const w = Math.max(320, Math.floor(el.getBoundingClientRect().width));
      setSize((prev) => (prev.w === w && prev.h === minHeight ? prev : { w, h: minHeight }));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minHeight]);

  useLayoutEffect(() => {
    if (prevFitKeyRef.current !== fitResetKey) {
      prevFitKeyRef.current = fitResetKey;
      userAdjustedRef.current = false;
    }
    if (userAdjustedRef.current) return;
    fitView(size.w, size.h, laidOut);
  }, [fitView, fitResetKey, laidOut, size.h, size.w]);

  const gridLines = useMemo(() => {
    const { w, h } = size;
    const minWX = (-pos.x) / scale;
    const maxWX = (w - pos.x) / scale;
    const minWY = (-pos.y) / scale;
    const maxWY = (h - pos.y) / scale;
    const pad = GRID * 3;
    const lines: ReactNode[] = [];
    const stroke = theme.grid;
    const sw = Math.max(0.65, 0.85 / scale);
    let k = 0;
    for (let x = Math.floor((minWX - pad) / GRID) * GRID; x <= maxWX + pad; x += GRID) {
      lines.push(<Line key={`v${k++}`} points={[x, minWY - pad, x, maxWY + pad]} stroke={stroke} strokeWidth={sw} listening={false} />);
    }
    for (let y = Math.floor((minWY - pad) / GRID) * GRID; y <= maxWY + pad; y += GRID) {
      lines.push(<Line key={`h${k++}`} points={[minWX - pad, y, maxWX + pad, y]} stroke={stroke} strokeWidth={sw} listening={false} />);
    }
    return lines;
  }, [size, pos, scale, theme.grid]);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    userAdjustedRef.current = true;
    const stage = stageRef.current;
    if (!stage) return;
    const dir = e.evt.deltaY > 0 ? -1 : 1;
    const factor = dir > 0 ? 1.06 : 1 / 1.06;
    const oldS = scale;
    let newS = oldS * factor;
    newS = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newS));
    const p = stage.getPointerPosition();
    if (!p) {
      setScale(newS);
      return;
    }
    const wx = (p.x - pos.x) / oldS;
    const wy = (p.y - pos.y) / oldS;
    setScale(newS);
    setPos({ x: p.x - wx * newS, y: p.y - wy * newS });
  };

  const swBase = Math.max(0.75, 1.05 / scale);
  const isDark = themeName === "dark";
  const symScale = 1.08;
  const canPick = Boolean(onSelectElementId);

  return (
    <div
      ref={hostRef}
      className="relative w-full overflow-hidden rounded-lg border border-ds-border"
      style={{ height: minHeight, width: "100%", background: theme.canvasBg }}
    >
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        x={pos.x}
        y={pos.y}
        scaleX={scale}
        scaleY={scale}
        onWheel={handleWheel}
      >
        <Layer listening={false} sortChildren>
          {gridLines}
          {laidOut
            .filter((el) => isRoom(el))
            .map((el) => {
              const polyPts = zonePolygonFlat(el);
              const sw = swBase;
              if (polyPts) {
                const bb = bboxFromPathPoints(polyPts);
                const labelSize = Math.min(11, Math.max(9, Math.min(bb.w, bb.h) / 7));
                return (
                  <Group key={el.id} {...ez(el.id)}>
                    <Line
                      points={polyPts}
                      closed
                      tension={0}
                      fill={theme.zoneFill}
                      stroke={theme.zoneStroke}
                      strokeWidth={sw}
                      lineJoin="round"
                      shadowColor={theme.zoneShadow}
                      shadowBlur={6}
                      shadowOpacity={0.12}
                      listening={canPick}
                      onClick={() => onSelectElementId?.(el.id)}
                      onTap={() => onSelectElementId?.(el.id)}
                    />
                    <Text
                      text={(el.metadata?.name ?? el.name ?? "ROOM").toUpperCase()}
                      x={bb.minX}
                      y={bb.minY}
                      width={bb.w}
                      height={bb.h}
                      align="center"
                      verticalAlign="middle"
                      fill={theme.zoneLabel}
                      opacity={0.94}
                      fontSize={labelSize}
                      fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
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
              const ins = Math.max(0.6, 1.05 / scale);
              const labelSize = Math.min(11, Math.max(9, Math.min(w, h) / 7));
              return (
                <Group key={el.id} {...ez(el.id)}>
                  <Rect
                    x={el.x + dx}
                    y={el.y + dy}
                    width={w}
                    height={h}
                    rotation={rot}
                    cornerRadius={ZONE_RADIUS}
                    fill={theme.mass}
                    listening={false}
                    opacity={0.85}
                  />
                  <Group x={el.x} y={el.y} rotation={rot} listening={false}>
                    <Line points={[ins, ins, w - ins, ins]} stroke={isDark ? "rgba(248, 250, 252, 0.34)" : "rgba(51, 65, 85, 0.2)"} strokeWidth={sw * 0.88} lineCap="round" listening={false} />
                    <Line points={[ins, ins, ins, h - ins]} stroke={isDark ? "rgba(248, 250, 252, 0.28)" : "rgba(51, 65, 85, 0.18)"} strokeWidth={sw * 0.88} lineCap="round" listening={false} />
                    <Line points={[ins, h - ins, w - ins, h - ins]} stroke={isDark ? "rgba(2, 6, 18, 0.45)" : "rgba(15, 23, 42, 0.22)"} strokeWidth={sw} lineCap="round" listening={false} />
                    <Line points={[w - ins, ins, w - ins, h - ins]} stroke={isDark ? "rgba(2, 6, 18, 0.48)" : "rgba(15, 23, 42, 0.24)"} strokeWidth={sw} lineCap="round" listening={false} />
                  </Group>
                  <Rect
                    x={el.x}
                    y={el.y}
                    width={w}
                    height={h}
                    rotation={rot}
                    cornerRadius={ZONE_RADIUS}
                    fill={theme.zoneFill}
                    stroke={theme.zoneStroke}
                    strokeWidth={sw}
                    shadowColor={theme.zoneShadow}
                    shadowBlur={6}
                    shadowOpacity={0.12}
                    listening={canPick}
                    onClick={() => onSelectElementId?.(el.id)}
                    onTap={() => onSelectElementId?.(el.id)}
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
                    fill={theme.zoneLabel}
                    opacity={0.94}
                    fontSize={labelSize}
                    fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
                    letterSpacing={2}
                    listening={false}
                    wrap="none"
                    ellipsis
                  />
                </Group>
              );
            })}
          {laidOut
            .filter((el) => el.type === "rectangle")
            .map((el) => {
              const w = el.width ?? 24;
              const h = el.height ?? 24;
              const sw = swBase;
              const cr = clampRectCornerRadiusRo(w, h, el.cornerRadius ?? 0);
              return (
                <Rect
                  key={el.id}
                  {...ez(el.id)}
                  x={el.x}
                  y={el.y}
                  width={w}
                  height={h}
                  rotation={el.rotation ?? 0}
                  cornerRadius={cr}
                  fill={isDark ? "rgba(148, 197, 255, 0.06)" : "rgba(59, 130, 246, 0.06)"}
                  stroke={isDark ? "rgba(148, 163, 184, 0.4)" : "rgba(71, 85, 105, 0.35)"}
                  strokeWidth={sw}
                  listening={false}
                />
              );
            })}
          {laidOut
            .filter((el) => el.type === "ellipse")
            .map((el) => {
              const w = el.width ?? 24;
              const h = el.height ?? 24;
              const sw = swBase;
              return (
                <Group key={el.id} {...ez(el.id)} x={el.x} y={el.y} rotation={el.rotation ?? 0} listening={false}>
                  <Ellipse
                    x={w / 2}
                    y={h / 2}
                    radiusX={Math.max(1, w / 2)}
                    radiusY={Math.max(1, h / 2)}
                    fill={isDark ? "rgba(56, 189, 248, 0.07)" : "rgba(14, 165, 233, 0.06)"}
                    stroke={isDark ? "rgba(125, 211, 252, 0.42)" : "rgba(2, 132, 199, 0.38)"}
                    strokeWidth={sw}
                    listening={false}
                  />
                </Group>
              );
            })}
          {laidOut
            .filter((el) => el.type === "polygon" && (el.path_points?.length ?? 0) >= 6)
            .map((el) => (
              <Line
                key={el.id}
                {...ez(el.id)}
                points={el.path_points ?? []}
                closed
                tension={0}
                fill={isDark ? "rgba(167, 139, 250, 0.08)" : "rgba(139, 92, 246, 0.07)"}
                stroke={isDark ? "rgba(196, 181, 253, 0.48)" : "rgba(124, 58, 237, 0.38)"}
                strokeWidth={swBase}
                lineJoin="round"
                listening={false}
              />
            ))}
          {laidOut
            .filter((el) => el.type === "door")
            .map((el) => {
              const along = el.width ?? DOOR_ALONG_DEFAULT;
              const depth = el.height ?? DOOR_DEPTH_DEFAULT;
              const bleed = Math.max(1.25, 2.2 / scale);
              const sw = Math.max(0.55, 0.88 / scale);
              const rot = el.rotation ?? 0;
              return (
                <Group key={el.id} {...ez(el.id)} x={el.x} y={el.y} rotation={rot} listening={false}>
                  <Rect x={-along / 2 - bleed} y={-depth / 2 - bleed} width={along + 2 * bleed} height={depth + 2 * bleed} cornerRadius={3} fill={theme.doorCut} listening={false} />
                  <Rect x={-along / 2} y={-depth / 2} width={along} height={depth} cornerRadius={2} fill={theme.doorFill} stroke={theme.doorStroke} strokeWidth={sw} listening={false} />
                </Group>
              );
            })}
          {laidOut
            .filter((el) => el.type === "symbol")
            .map((el) => {
              const w = el.width ?? SYMBOL_DEFAULT;
              const h = el.height ?? SYMBOL_DEFAULT;
              const st = el.symbol_type ?? "generic";
              const symLabelFs = Math.min(9, w / 5);
              const labelBand = Math.ceil(symLabelFs + SYMBOL_LABEL_BAND_GAP);
              const iconSlotH = Math.max(4, h - labelBand);
              return (
                <Group
                  key={el.id}
                  {...ez(el.id)}
                  x={el.x}
                  y={el.y}
                  rotation={el.rotation ?? 0}
                  opacity={0.98}
                  listening={canPick}
                  onClick={() => onSelectElementId?.(el.id)}
                  onTap={() => onSelectElementId?.(el.id)}
                >
                  <Rect width={w} height={h} cornerRadius={8} fill={theme.symbolPlate} strokeEnabled={false} listening={false} />
                  <Group x={w / 2} y={iconSlotH / 2 - SYMBOL_ICON_Y_NUDGE} scaleX={symScale} scaleY={symScale} listening={false}>
                    <SymbolGlyphRo symbolType={st} isDark={isDark} />
                  </Group>
                  <Text
                    text={(el.name ?? st).toUpperCase()}
                    x={0}
                    y={iconSlotH}
                    width={w}
                    height={labelBand}
                    align="center"
                    verticalAlign="middle"
                    fill={theme.label}
                    opacity={0.88}
                    fontSize={symLabelFs}
                    fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
                    listening={false}
                    wrap="none"
                    ellipsis
                  />
                </Group>
              );
            })}
          {laidOut
            .filter((el) => el.type === "device")
            .map((el) => {
              const w = el.width ?? DEVICE_DEFAULT;
              const h = el.height ?? DEVICE_DEFAULT;
              const kind = el.device_kind ?? "generic";
              const st = mockLinkStatus(el.linked_device_id);
              const dStroke = Math.max(0.65, 0.92 / scale);
              return (
                <Group
                  key={el.id}
                  {...ez(el.id)}
                  x={el.x}
                  y={el.y}
                  rotation={el.rotation ?? 0}
                  listening={canPick}
                  onClick={() => onSelectElementId?.(el.id)}
                  onTap={() => onSelectElementId?.(el.id)}
                >
                  <Rect
                    width={w}
                    height={h}
                    cornerRadius={10}
                    fill={theme.devicePlate}
                    stroke={theme.deviceStroke}
                    strokeWidth={dStroke}
                    listening={false}
                  />
                  <Group opacity={0.94} x={w / 2} y={h / 2} scaleX={symScale} scaleY={symScale} listening={false}>
                    <DeviceGlyphRo kind={kind} statusKey={st} strokeScale={1} />
                  </Group>
                  <Text
                    text={(el.name ?? kind).toUpperCase()}
                    x={4}
                    y={h - 13}
                    width={w - 8}
                    align="center"
                    fill={theme.label}
                    opacity={0.9}
                    fontSize={9}
                    fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
                    letterSpacing={1.4}
                    listening={false}
                    ellipsis
                  />
                </Group>
              );
            })}
          {laidOut
            .filter((el) => el.type === "path" && (el.path_points?.length ?? 0) >= 6)
            .map((el) => {
              const pts = el.path_points ?? [];
              const sw = Math.max(0.65, 1 / scale);
              return (
                <Line
                  key={el.id}
                  {...ez(el.id)}
                  points={pts}
                  closed
                  tension={PATH_LINE_TENSION}
                  fill={theme.pathFill}
                  stroke={theme.pathStroke}
                  strokeWidth={sw}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              );
            })}
          {laidOut
            .filter((el) => el.type === "connection" && (el.path_points?.length ?? 0) >= 4)
            .map((el) => {
              const pts = el.path_points ?? [];
              const isPlumb = el.connection_style === "plumbing";
              const sw = isPlumb ? Math.max(1.2, 1.85 / scale) : Math.max(0.75, 1.2 / scale);
              const stroke = isPlumb ? "rgba(6, 182, 212, 0.9)" : theme.pathStroke;
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
                  listening={false}
                />
              );
            })}
        </Layer>
      </Stage>
      <p className="pointer-events-none absolute bottom-2 right-3 m-0 text-[10px] text-ds-muted opacity-80">
        Scroll to zoom
      </p>
    </div>
  );
}
