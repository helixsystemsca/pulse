"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CommunicationsModuleShell } from "@/components/communications/CommunicationsModuleShell";
import { DimensionEditModal } from "@/modules/communications/advertising-mapper/components/DimensionEditModal";
import { InventoryDetailsPanel } from "@/modules/communications/advertising-mapper/components/InventoryDetailsPanel";
import { InventoryPlannerCanvas } from "@/modules/communications/advertising-mapper/components/InventoryPlannerCanvas";
import { PlannerToolbar } from "@/modules/communications/advertising-mapper/components/PlannerToolbar";
import { cloneWallPlans, MOCK_WALL_PLANS } from "@/modules/communications/advertising-mapper/data/mock-walls";
import { usePlannerViewport } from "@/modules/communications/advertising-mapper/hooks/usePlannerViewport";
import { RULER_THICKNESS_PX } from "@/modules/communications/advertising-mapper/components/AxisRulers";
import type {
  DimensionEditTarget,
  FacilityWallPlan,
  InventoryBlock,
  MeasurementUnit,
} from "@/modules/communications/advertising-mapper/types";

export function AdvertisingMapperPage() {
  const [walls, setWalls] = useState<FacilityWallPlan[]>(() => cloneWallPlans());
  const [wallId, setWallId] = useState(MOCK_WALL_PLANS[0]!.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [unit, setUnit] = useState<MeasurementUnit>("ft");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [dimEdit, setDimEdit] = useState<{ id: string; focus: DimensionEditTarget } | null>(null);

  const { viewport, setViewport, zoomBy, resetView } = usePlannerViewport();

  const wall = useMemo(() => walls.find((w) => w.id === wallId) ?? walls[0]!, [walls, wallId]);
  const selected = useMemo(() => wall.blocks.find((b) => b.id === selectedId) ?? null, [wall.blocks, selectedId]);

  const updateWallBlocks = useCallback(
    (updater: (blocks: InventoryBlock[]) => InventoryBlock[]) => {
      setWalls((prev) =>
        prev.map((w) => (w.id !== wallId ? w : { ...w, blocks: updater(w.blocks) })),
      );
    },
    [wallId],
  );

  const onBlockChange = useCallback(
    (id: string, patch: Partial<InventoryBlock>) => {
      updateWallBlocks((blocks) => blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    },
    [updateWallBlocks],
  );

  const scalePercent = Math.round(viewport.scale * 100);

  const handleZoomIn = useCallback(() => {
    zoomBy(1.12, 400, 300, RULER_THICKNESS_PX, RULER_THICKNESS_PX);
  }, [zoomBy]);

  const handleZoomOut = useCallback(() => {
    zoomBy(0.88, 400, 300, RULER_THICKNESS_PX, RULER_THICKNESS_PX);
  }, [zoomBy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const step = e.shiftKey ? 12 : 6;
      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const block = wall.blocks.find((b) => b.id === selectedId);
        if (!block) return;
        const patch: Partial<InventoryBlock> = {};
        if (e.key === "ArrowLeft") patch.x = block.x - step;
        if (e.key === "ArrowRight") patch.x = block.x + step;
        if (e.key === "ArrowUp") patch.y = block.y - step;
        if (e.key === "ArrowDown") patch.y = block.y + step;
        onBlockChange(selectedId, patch);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBlockChange, selectedId, wall.blocks]);

  return (
    <CommunicationsModuleShell
      title="Advertisement mapping"
      description="Spatial inventory planner for arena walls, concourse signage, and sponsorship placements — dimensions, pricing, and contract-ready geometry."
    >
      <div className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-ds-border bg-ds-primary/90 shadow-[var(--ds-shadow-card)]">
        <PlannerToolbar
          wallName={wall.name}
          unit={unit}
          onUnitChange={setUnit}
          scalePercent={scalePercent}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={resetView}
          snapEnabled={snapEnabled}
          onSnapToggle={() => setSnapEnabled((v) => !v)}
          showGrid={showGrid}
          onGridToggle={() => setShowGrid((v) => !v)}
        />

        <PlannerGridLayout>
          <WallLayoutPicker
            walls={walls}
            wallId={wallId}
            onWallChange={(id: string) => {
              setWallId(id);
              setSelectedId(null);
              resetView();
            }}
          />
          <InventoryPlannerCanvas
            wall={wall}
            blocks={wall.blocks}
            selectedId={selectedId}
            unit={unit}
            viewport={viewport}
            onViewportChange={setViewport}
            snapEnabled={snapEnabled}
            showGrid={showGrid}
            onSelect={setSelectedId}
            onBlockChange={onBlockChange}
            onDimensionBadgeClick={(id, focus) => setDimEdit({ id, focus })}
            className="min-h-[480px] flex-1"
          />
          <InventoryDetailsPanel
            block={selected}
            unit={unit}
            onUpdate={(patch) => {
              if (selectedId) onBlockChange(selectedId, patch);
            }}
          />
        </PlannerGridLayout>
      </div>

      {selected && dimEdit?.id === selected.id ? (
        <DimensionEditModal
          open
          blockName={selected.name}
          widthInches={selected.width_inches}
          heightInches={selected.height_inches}
          unit={unit}
          initialFocus={dimEdit.focus}
          onClose={() => setDimEdit(null)}
          onApply={(width_inches, height_inches) => onBlockChange(selected.id, { width_inches, height_inches })}
        />
      ) : null}
    </CommunicationsModuleShell>
  );
}

function PlannerGridLayout({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[200px_1fr_300px]">{children}</div>;
}

function WallLayoutPicker({
  walls,
  wallId,
  onWallChange,
}: {
  walls: FacilityWallPlan[];
  wallId: string;
  onWallChange: (id: string) => void;
}) {
  return (
    <div className="hidden border-r border-ds-border/80 bg-ds-secondary/20 p-3 lg:block">
      <label className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Wall layout</label>
      <select
        className="mt-2 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground"
        value={wallId}
        onChange={(e) => onWallChange(e.target.value)}
      >
        {walls.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <p className="mt-3 text-[11px] leading-relaxed text-ds-muted">
        Photo backdrops and CAD imports will attach per wall revision. Geometry is stored in inches.
      </p>
    </div>
  );
}
