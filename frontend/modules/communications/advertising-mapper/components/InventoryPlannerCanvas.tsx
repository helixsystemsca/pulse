"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { Group, Layer, Stage } from "react-konva";
import { BackdropLayer } from "@/modules/communications/advertising-mapper/components/layers/BackdropLayer";
import { ConstraintLayer } from "@/modules/communications/advertising-mapper/components/layers/ConstraintLayer";
import { InventoryLayer, InventoryTransformer } from "@/modules/communications/advertising-mapper/components/layers/InventoryLayer";
import { AxisRulers } from "@/modules/communications/advertising-mapper/components/AxisRulers";
import { PlannerMinimap } from "@/modules/communications/advertising-mapper/components/PlannerMinimap";
import { createConstraintRegion, moveAnchorInPoints, removePolygonVertex } from "@/modules/communications/advertising-mapper/geometry/factory";
import {
  CLOSE_POLYGON_THRESHOLD_INCHES,
  isNearPoint,
  isValidClosedPolygon,
} from "@/modules/communications/advertising-mapper/geometry/polygon-math";
import { inventoryViolatesBlockedConstraints } from "@/modules/communications/advertising-mapper/geometry/collision";
import type { ConstraintRegion, ConstraintType, PlannerToolMode } from "@/modules/communications/advertising-mapper/geometry/types";
import { useBackdropImage } from "@/modules/communications/advertising-mapper/hooks/useBackdropImage";
import {
  BASE_PX_PER_INCH,
  RULER_THICKNESS_PX,
  zoomViewportAtPoint,
  type PlannerViewport,
} from "@/modules/communications/advertising-mapper/lib/coordinates";
import { pointerToWallInches } from "@/modules/communications/advertising-mapper/lib/pointer-to-wall";
import { clampBlockSize, clampBlockToWall, snapInches } from "@/modules/communications/advertising-mapper/lib/snap";
import type {
  DimensionEditTarget,
  FacilityWallPlan,
  InventoryBlock,
  MeasurementUnit,
} from "@/modules/communications/advertising-mapper/types";
import { cn } from "@/lib/cn";

type Props = {
  wall: FacilityWallPlan;
  blocks: InventoryBlock[];
  constraints: ConstraintRegion[];
  toolMode: PlannerToolMode;
  draftConstraintType: ConstraintType;
  selectedInventoryId: string | null;
  selectedConstraintId: string | null;
  unit: MeasurementUnit;
  viewport: PlannerViewport;
  onViewportChange: (v: PlannerViewport) => void;
  snapEnabled: boolean;
  showGrid: boolean;
  onSelectInventory: (id: string | null) => void;
  onSelectConstraint: (id: string | null) => void;
  onBlockChange: (id: string, patch: Partial<InventoryBlock>) => void;
  onConstraintCreate: (region: ConstraintRegion) => void;
  onConstraintPointsChange: (id: string, points: number[]) => void;
  onDimensionBadgeClick: (id: string, target: DimensionEditTarget) => void;
  /** When false, status hints are rendered by SpatialWorkspaceShell. */
  showFloatingHints?: boolean;
  className?: string;
};

const CURSOR_BY_MODE: Record<PlannerToolMode, string> = {
  select: "default",
  inventory: "grab",
  constraint: "crosshair",
  pan: "grab",
};

export function InventoryPlannerCanvas({
  wall,
  blocks,
  constraints,
  toolMode,
  draftConstraintType,
  selectedInventoryId,
  selectedConstraintId,
  unit,
  viewport,
  onViewportChange,
  snapEnabled,
  showGrid,
  onSelectInventory,
  onSelectConstraint,
  onBlockChange,
  onConstraintCreate,
  onConstraintPointsChange,
  onDimensionBadgeClick,
  showFloatingHints = true,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 520 });
  const [draftPoints, setDraftPoints] = useState<number[]>([]);
  const [cursorInches, setCursorInches] = useState<{ x: number; y: number } | null>(null);
  const panRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number } | null>(null);

  const backdropImage = useBackdropImage(wall.backdropUrl);
  const gridInches = wall.gridSnapInches ?? 6;
  const wallWidthPx = wall.width_inches * BASE_PX_PER_INCH;
  const wallHeightPx = wall.height_inches * BASE_PX_PER_INCH;

  const violationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of blocks) {
      if (inventoryViolatesBlockedConstraints(block, constraints).length > 0) {
        ids.add(block.id);
      }
    }
    return ids;
  }, [blocks, constraints]);

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
    if (toolMode !== "constraint") setDraftPoints([]);
  }, [toolMode]);

  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage || toolMode === "pan" || toolMode === "constraint") {
      tr?.nodes([]);
      tr?.getLayer()?.batchDraw();
      return;
    }
    if (!selectedInventoryId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne(`#block-${selectedInventoryId}`);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedInventoryId, blocks, viewport.scale, toolMode]);

  const wallPointFromEvent = useCallback(
    (evt: { clientX: number; clientY: number }) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return pointerToWallInches(evt.clientX, evt.clientY, rect, viewport);
    },
    [viewport],
  );

  const finalizeDraft = useCallback(() => {
    if (!isValidClosedPolygon(draftPoints)) return;
    const region = createConstraintRegion(draftPoints, draftConstraintType);
    if (region) {
      onConstraintCreate(region);
      setDraftPoints([]);
    }
  }, [draftPoints, draftConstraintType, onConstraintCreate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (toolMode === "constraint") {
        if (e.key === "Escape") {
          setDraftPoints([]);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          finalizeDraft();
          return;
        }
      }
      if (toolMode === "select" && selectedConstraintId && e.key === "Delete") {
        const region = constraints.find((c) => c.id === selectedConstraintId);
        if (!region || region.points.length < 8) return;
        const next = removePolygonVertex(region.points, 0);
        if (next) onConstraintPointsChange(selectedConstraintId, next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [constraints, finalizeDraft, onConstraintPointsChange, selectedConstraintId, toolMode]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      onViewportChange(
        zoomViewportAtPoint(viewport, e.clientX - rect.left, e.clientY - rect.top, RULER_THICKNESS_PX, RULER_THICKNESS_PX, factor),
      );
    },
    [viewport, onViewportChange],
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== e.target.getStage()) return;
      if (toolMode === "pan") return;
      if (toolMode === "constraint") {
        const pt = wallPointFromEvent(e.evt);
        if (!pt) return;
        if (draftPoints.length >= 6) {
          const fx = draftPoints[0]!;
          const fy = draftPoints[1]!;
          if (isNearPoint(pt.x, pt.y, fx, fy, CLOSE_POLYGON_THRESHOLD_INCHES / viewport.scale)) {
            finalizeDraft();
            return;
          }
        }
        setDraftPoints((prev) => [...prev, pt.x, pt.y]);
        return;
      }
      onSelectInventory(null);
      onSelectConstraint(null);
    },
    [draftPoints, finalizeDraft, onSelectConstraint, onSelectInventory, toolMode, viewport.scale, wallPointFromEvent],
  );

  const finishBlockDrag = useCallback(
    (id: string, node: Konva.Group) => {
      let x = snapInches(node.x() / BASE_PX_PER_INCH, gridInches, snapEnabled);
      let y = snapInches(node.y() / BASE_PX_PER_INCH, gridInches, snapEnabled);
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

  const inventoryDraggable = toolMode === "select" || toolMode === "inventory";

  return (
    <div
      ref={containerRef}
      className={cn("relative min-h-0 flex-1 overflow-hidden bg-[#0f1419]", className)}
      style={{ cursor: CURSOR_BY_MODE[toolMode] }}
      onWheel={handleWheel}
    >
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
          if (toolMode === "pan" || e.evt.button === 1 || e.evt.altKey) {
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
          const pt = wallPointFromEvent(e.evt);
          setCursorInches(pt);
          const p = panRef.current;
          if (p?.active) {
            onViewportChange({
              ...viewport,
              panX: p.panX + (e.evt.clientX - p.startX),
              panY: p.panY + (e.evt.clientY - p.startY),
            });
          }
        }}
        onMouseUp={() => {
          if (panRef.current) panRef.current.active = false;
        }}
        onClick={handleStageClick}
      >
        <Layer>
          <Group x={RULER_THICKNESS_PX + viewport.panX} y={RULER_THICKNESS_PX + viewport.panY} scaleX={viewport.scale} scaleY={viewport.scale}>
            <BackdropLayer
              wall={wall}
              widthPx={wallWidthPx}
              heightPx={wallHeightPx}
              showGrid={showGrid}
              gridInches={gridInches}
              image={backdropImage}
            />
            <ConstraintLayer
              constraints={constraints}
              draftPoints={draftPoints}
              cursorInches={cursorInches}
              selectedConstraintId={selectedConstraintId}
              toolMode={toolMode}
              onSelectConstraint={(id) => {
                onSelectConstraint(id);
                onSelectInventory(null);
              }}
              onAnchorDrag={(constraintId, vertexIndex, x, y) => {
                const region = constraints.find((c) => c.id === constraintId);
                if (!region) return;
                const next = moveAnchorInPoints(region.points, vertexIndex, x, y);
                onConstraintPointsChange(constraintId, next);
              }}
            />
            <InventoryLayer
              blocks={blocks}
              unit={unit}
              selectedId={selectedInventoryId}
              draggable={inventoryDraggable}
              violationIds={violationIds}
              onSelect={(id) => {
                onSelectInventory(id);
                onSelectConstraint(null);
              }}
              onDragEnd={finishBlockDrag}
              onTransformEnd={finishBlockTransform}
              onDimensionBadgeClick={onDimensionBadgeClick}
            />
          </Group>
          <InventoryTransformer
            ref={transformerRef}
            rotateEnabled={false}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 24 || newBox.height < 24 ? oldBox : newBox)}
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
        constraints={constraints}
        viewportRect={viewportWorld()}
        onNavigate={(wx, wy) => {
          onViewportChange({
            ...viewport,
            panX: -(wx * BASE_PX_PER_INCH * viewport.scale) + (stageSize.width - RULER_THICKNESS_PX) / 4,
            panY: -(wy * BASE_PX_PER_INCH * viewport.scale) + (stageSize.height - RULER_THICKNESS_PX) / 4,
          });
        }}
      />
      {showFloatingHints ? (
        <p className="pointer-events-none absolute bottom-3 left-[11rem] z-20 max-w-md rounded-md bg-black/55 px-2 py-1 text-[10px] text-white/85">
          {toolMode === "constraint"
            ? "Click to place points · click first point to close · Enter finalize · Esc cancel"
            : "Scroll zoom · Pan mode or Alt-drag · V/I/C/H tool shortcuts"}
        </p>
      ) : null}
    </div>
  );
}
