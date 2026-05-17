"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type Konva from "konva";
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import {
  BASE_PX_PER_INCH,
  RULER_THICKNESS_PX,
  zoomViewportAtPoint,
  type PlannerViewport,
} from "@/modules/communications/advertising-mapper/lib/coordinates";
import { blockStyleForStatus } from "@/modules/communications/advertising-mapper/lib/block-styles";
import { formatMeasurement } from "@/modules/communications/advertising-mapper/lib/measurements";
import { clampBlockSize, clampBlockToWall, snapInches } from "@/modules/communications/advertising-mapper/lib/snap";
import { AxisRulers } from "@/modules/communications/advertising-mapper/components/AxisRulers";
import { PlannerMinimap } from "@/modules/communications/advertising-mapper/components/PlannerMinimap";
import type {
  DimensionEditTarget,
  FacilityWallPlan,
  InventoryBlock,
  MeasurementUnit,
} from "@/modules/communications/advertising-mapper/types";

type Props = {
  wall: FacilityWallPlan;
  blocks: InventoryBlock[];
  selectedId: string | null;
  unit: MeasurementUnit;
  viewport: PlannerViewport;
  onViewportChange: (v: PlannerViewport) => void;
  snapEnabled: boolean;
  showGrid: boolean;
  onSelect: (id: string | null) => void;
  onBlockChange: (id: string, patch: Partial<InventoryBlock>) => void;
  onDimensionBadgeClick: (id: string, target: DimensionEditTarget) => void;
  className?: string;
};

export function InventoryPlannerCanvas({
  wall,
  blocks,
  selectedId,
  unit,
  viewport,
  onViewportChange,
  snapEnabled,
  showGrid,
  onSelect,
  onBlockChange,
  onDimensionBadgeClick,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 520 });
  const panRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number } | null>(null);

  const gridInches = wall.gridSnapInches ?? 6;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setStageSize({ width: Math.floor(cr.width), height: Math.floor(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne(`#block-${selectedId}`);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, blocks, viewport.scale]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const next = zoomViewportAtPoint(
        viewport,
        e.clientX - rect.left,
        e.clientY - rect.top,
        RULER_THICKNESS_PX,
        RULER_THICKNESS_PX,
        factor,
      );
      onViewportChange(next);
    },
    [viewport, onViewportChange],
  );

  const finishBlockDrag = useCallback(
    (id: string, node: Konva.Group) => {
      const grid = gridInches;
      let x = snapInches(node.x() / BASE_PX_PER_INCH, grid, snapEnabled);
      let y = snapInches(node.y() / BASE_PX_PER_INCH, grid, snapEnabled);
      const block = blocks.find((b) => b.id === id);
      if (!block) return;
      const clamped = clampBlockToWall(x, y, block.width_inches, block.height_inches, wall.width_inches, wall.height_inches);
      node.position({ x: clamped.x * BASE_PX_PER_INCH, y: clamped.y * BASE_PX_PER_INCH });
      onBlockChange(id, { x: clamped.x, y: clamped.y });
    },
    [blocks, gridInches, onBlockChange, snapEnabled, wall.height_inches, wall.width_inches],
  );

  const finishBlockTransform = useCallback(
    (id: string, node: Konva.Group) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      const rect = node.findOne("Rect");
      const baseW = rect ? rect.width() : node.width();
      const baseH = rect ? rect.height() : node.height();
      let widthIn = snapInches((baseW * scaleX) / BASE_PX_PER_INCH, gridInches, snapEnabled);
      let heightIn = snapInches((baseH * scaleY) / BASE_PX_PER_INCH, gridInches, snapEnabled);
      const sized = clampBlockSize(widthIn, heightIn, 6, wall.width_inches, wall.height_inches);
      widthIn = sized.width;
      heightIn = sized.height;
      const x = snapInches(node.x() / BASE_PX_PER_INCH, gridInches, snapEnabled);
      const y = snapInches(node.y() / BASE_PX_PER_INCH, gridInches, snapEnabled);
      const clamped = clampBlockToWall(x, y, widthIn, heightIn, wall.width_inches, wall.height_inches);
      node.position({ x: clamped.x * BASE_PX_PER_INCH, y: clamped.y * BASE_PX_PER_INCH });
      onBlockChange(id, { x: clamped.x, y: clamped.y, width_inches: widthIn, height_inches: heightIn });
    },
    [gridInches, onBlockChange, snapEnabled, wall.height_inches, wall.width_inches],
  );

  const viewportWorld = useCallback(() => {
    const viewW = (stageSize.width - RULER_THICKNESS_PX) / (BASE_PX_PER_INCH * viewport.scale);
    const viewH = (stageSize.height - RULER_THICKNESS_PX) / (BASE_PX_PER_INCH * viewport.scale);
    const x = -viewport.panX / (BASE_PX_PER_INCH * viewport.scale);
    const y = -viewport.panY / (BASE_PX_PER_INCH * viewport.scale);
    return { x: Math.max(0, x), y: Math.max(0, y), width: viewW, height: viewH };
  }, [stageSize, viewport]);

  return (
    <div ref={containerRef} className={className ?? "relative min-h-0 flex-1 overflow-hidden bg-[#0f1419]"} onWheel={handleWheel}>
      <AxisRulers
        wallWidthInches={wall.width_inches}
        wallHeightInches={wall.height_inches}
        viewport={viewport}
        unit={unit}
        stageWidth={stageSize.width}
        stageHeight={stageSize.height}
      />
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            onSelect(null);
          }
          if (e.evt.button === 1 || e.evt.button === 2 || e.evt.altKey) {
            panRef.current = {
              active: true,
              startX: e.evt.clientX,
              startY: e.evt.clientY,
              panX: viewport.panX,
              panY: viewport.panY,
            };
          }
        }}
        onMouseMove={(e) => {
          const p = panRef.current;
          if (!p?.active) return;
          onViewportChange({
            ...viewport,
            panX: p.panX + (e.evt.clientX - p.startX),
            panY: p.panY + (e.evt.clientY - p.startY),
          });
        }}
        onMouseUp={() => {
          if (panRef.current) panRef.current.active = false;
        }}
      >
        <Layer>
          <Group x={RULER_THICKNESS_PX + viewport.panX} y={RULER_THICKNESS_PX + viewport.panY} scaleX={viewport.scale} scaleY={viewport.scale}>
            <WallBackdrop
              widthPx={wall.width_inches * BASE_PX_PER_INCH}
              heightPx={wall.height_inches * BASE_PX_PER_INCH}
              kind={wall.backdropKind}
              showGrid={showGrid}
              gridInches={gridInches}
            />
            {blocks.map((block) => (
              <InventoryBlockNode
                key={block.id}
                block={block}
                unit={unit}
                selected={block.id === selectedId}
                onSelect={() => onSelect(block.id)}
                onDragEnd={(node) => finishBlockDrag(block.id, node)}
                onTransformEnd={(node) => finishBlockTransform(block.id, node)}
                onBadgeClick={(target) => onDimensionBadgeClick(block.id, target)}
              />
            ))}
          </Group>
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 24 || newBox.height < 24) return oldBox;
              return newBox;
            }}
            anchorStroke="var(--ds-accent)"
            borderStroke="var(--ds-accent)"
            anchorFill="#fff"
            anchorSize={8}
          />
        </Layer>
      </Stage>
      <PlannerMinimap
        wall={wall}
        blocks={blocks}
        viewportRect={viewportWorld()}
        onNavigate={(wx, wy) => {
          onViewportChange({
            ...viewport,
            panX: -(wx * BASE_PX_PER_INCH * viewport.scale) + (stageSize.width - RULER_THICKNESS_PX) / 4,
            panY: -(wy * BASE_PX_PER_INCH * viewport.scale) + (stageSize.height - RULER_THICKNESS_PX) / 4,
          });
        }}
      />
      <p className="pointer-events-none absolute bottom-3 left-[11rem] z-20 rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/80">
        Scroll to zoom · Alt-drag to pan · Click dimension badges to edit
      </p>
    </div>
  );
}

function WallBackdrop({
  widthPx,
  heightPx,
  kind,
  showGrid,
  gridInches,
}: {
  widthPx: number;
  heightPx: number;
  kind: FacilityWallPlan["backdropKind"];
  showGrid: boolean;
  gridInches: number;
}) {
  const gradient =
    kind === "arena"
      ? { top: "#3d4a5c", mid: "#2a3344", bottom: "#121820" }
      : kind === "concourse"
        ? { top: "#4a5568", mid: "#374151", bottom: "#1f2937" }
        : { top: "#52525b", mid: "#3f3f46", bottom: "#27272a" };

  const gridStep = gridInches * BASE_PX_PER_INCH;
  const gridLines: ReactNode[] = [];
  if (showGrid) {
    for (let x = 0; x <= widthPx; x += gridStep) {
      gridLines.push(<Line key={`gx-${x}`} points={[x, 0, x, heightPx]} stroke="rgba(255,255,255,0.06)" strokeWidth={1} listening={false} />);
    }
    for (let y = 0; y <= heightPx; y += gridStep) {
      gridLines.push(<Line key={`gy-${y}`} points={[0, y, widthPx, y]} stroke="rgba(255,255,255,0.06)" strokeWidth={1} listening={false} />);
    }
  }

  return (
    <Group listening={false}>
      <Rect
        width={widthPx}
        height={heightPx}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: heightPx }}
        fillLinearGradientColorStops={[0, gradient.top, 0.45, gradient.mid, 1, gradient.bottom]}
        shadowColor="black"
        shadowBlur={16}
        shadowOpacity={0.35}
      />
      {kind === "arena" ? (
        <Rect y={heightPx * 0.62} width={widthPx} height={heightPx * 0.38} fill="#0a0e14" opacity={0.85} listening={false} />
      ) : null}
      {gridLines}
      <Rect width={widthPx} height={heightPx} stroke="rgba(255,255,255,0.2)" strokeWidth={2} listening={false} />
    </Group>
  );
}

function InventoryBlockNode({
  block,
  unit,
  selected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  onBadgeClick,
}: {
  block: InventoryBlock;
  unit: MeasurementUnit;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (node: Konva.Group) => void;
  onTransformEnd: (node: Konva.Group) => void;
  onBadgeClick: (target: DimensionEditTarget) => void;
}) {
  const style = blockStyleForStatus(block.status);
  const w = block.width_inches * BASE_PX_PER_INCH;
  const h = block.height_inches * BASE_PX_PER_INCH;
  const widthLabel = formatMeasurement(block.width_inches, unit);
  const heightLabel = formatMeasurement(block.height_inches, unit);

  return (
    <Group
      id={`block-${block.id}`}
      x={block.x * BASE_PX_PER_INCH}
      y={block.y * BASE_PX_PER_INCH}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onDragEnd(e.target as Konva.Group)}
      onTransformEnd={(e) => onTransformEnd(e.target as Konva.Group)}
    >
      <Rect
        width={w}
        height={h}
        fill={style.fill}
        stroke={selected ? "var(--ds-accent)" : style.stroke}
        strokeWidth={selected ? 2.5 : 1.5}
        cornerRadius={2}
        shadowColor="black"
        shadowBlur={8}
        shadowOpacity={0.35}
      />
      <Rect x={8} y={8} width={Math.min(w - 16, 90)} height={16} fill={style.chipBg} cornerRadius={3} listening={false} />
      <Text x={12} y={10} text={style.label} fontSize={9} fontStyle="bold" fill="#fff" listening={false} />
      <Text x={8} y={28} text={block.name} fontSize={11} fontStyle="bold" fill="#f8fafc" width={w - 16} ellipsis listening={false} />
      {block.sponsor ? (
        <Text x={8} y={h - 18} text={block.sponsor} fontSize={9} fill="#cbd5e1" width={w - 16} ellipsis listening={false} />
      ) : null}
      <DimensionBadge x={w / 2} y={-10} label={widthLabel} onClick={() => onBadgeClick("width")} />
      <DimensionBadge x={-10} y={h / 2} label={heightLabel} vertical onClick={() => onBadgeClick("height")} />
    </Group>
  );
}

function DimensionBadge({
  x,
  y,
  label,
  vertical,
  onClick,
}: {
  x: number;
  y: number;
  label: string;
  vertical?: boolean;
  onClick: () => void;
}) {
  const padX = 6;
  const padY = 3;
  const textW = label.length * 5.5 + padX * 2;
  const textH = 14 + padY * 2;
  const bw = vertical ? textH : textW;
  const bh = vertical ? textW : textH;

  return (
    <Group
      x={x - bw / 2}
      y={y - bh / 2}
      onClick={(e) => {
        e.cancelBubble = true;
        onClick();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onClick();
      }}
    >
      <Rect width={bw} height={bh} fill="rgba(15, 23, 42, 0.92)" stroke="var(--ds-accent)" strokeWidth={1} cornerRadius={4} />
      <Text
        x={padX}
        y={padY}
        text={label}
        fontSize={10}
        fontStyle="bold"
        fill="#e2e8f0"
        rotation={vertical ? -90 : 0}
        offsetX={vertical ? 0 : 0}
        offsetY={vertical ? textW / 2 - padX : 0}
      />
    </Group>
  );
}
