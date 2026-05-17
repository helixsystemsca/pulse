"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdvertisingWorkspaceHeader } from "@/modules/communications/advertising-mapper/components/AdvertisingWorkspaceHeader";
import { ConstraintDetailsPanel } from "@/modules/communications/advertising-mapper/components/ConstraintDetailsPanel";
import { DimensionEditModal } from "@/modules/communications/advertising-mapper/components/DimensionEditModal";
import { InventoryDetailsPanel } from "@/modules/communications/advertising-mapper/components/InventoryDetailsPanel";
import { InventoryPlannerCanvas } from "@/modules/communications/advertising-mapper/components/InventoryPlannerCanvas";
import { cloneWallPlans, MOCK_WALL_PLANS } from "@/modules/communications/advertising-mapper/data/mock-walls";
import type { ConstraintRegion, ConstraintType, PlannerToolMode } from "@/modules/communications/advertising-mapper/geometry/types";
import { usePlannerViewport } from "@/modules/communications/advertising-mapper/hooks/usePlannerViewport";
import { RULER_THICKNESS_PX } from "@/modules/communications/advertising-mapper/components/AxisRulers";
import type {
  DimensionEditTarget,
  FacilityWallPlan,
  InventoryBlock,
  MeasurementUnit,
} from "@/modules/communications/advertising-mapper/types";
import {
  getSpatialWorkspace,
  SpatialViewportControls,
  SpatialWorkspaceShell,
  useSpatialWorkspaceTools,
} from "@/spatial-engine/workspace";

export function AdvertisingMapperPage() {
  const [walls, setWalls] = useState<FacilityWallPlan[]>(() => cloneWallPlans());
  const [wallId, setWallId] = useState(MOCK_WALL_PLANS[0]!.id);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [selectedConstraintId, setSelectedConstraintId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<PlannerToolMode>("select");
  const [draftConstraintType, setDraftConstraintType] = useState<ConstraintType>("blocked");
  const [unit, setUnit] = useState<MeasurementUnit>("ft");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [dimEdit, setDimEdit] = useState<{ id: string; focus: DimensionEditTarget } | null>(null);

  const { viewport, setViewport, zoomBy, resetView } = usePlannerViewport();
  const workspace = getSpatialWorkspace("advertising");

  const wall = useMemo(() => walls.find((w) => w.id === wallId) ?? walls[0]!, [walls, wallId]);
  const selectedInventory = useMemo(
    () => wall.blocks.find((b) => b.id === selectedInventoryId) ?? null,
    [wall.blocks, selectedInventoryId],
  );
  const selectedConstraint = useMemo(
    () => wall.constraints.find((c) => c.id === selectedConstraintId) ?? null,
    [wall.constraints, selectedConstraintId],
  );

  const onToolChange = useCallback((id: string) => {
    setToolMode(id as PlannerToolMode);
  }, []);

  useSpatialWorkspaceTools(workspace.tools, onToolChange);

  const updateWall = useCallback(
    (patch: Partial<FacilityWallPlan>) => {
      setWalls((prev) => prev.map((w) => (w.id !== wallId ? w : { ...w, ...patch })));
    },
    [wallId],
  );

  const onBlockChange = useCallback(
    (id: string, patch: Partial<InventoryBlock>) => {
      updateWall({ blocks: wall.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
    },
    [updateWall, wall.blocks],
  );

  const onConstraintChange = useCallback(
    (id: string, patch: Partial<ConstraintRegion>) => {
      updateWall({
        constraints: wall.constraints.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
        ),
      });
    },
    [updateWall, wall.constraints],
  );

  const onConstraintPointsChange = useCallback(
    (id: string, points: number[]) => {
      onConstraintChange(id, { points });
    },
    [onConstraintChange],
  );

  const onConstraintCreate = useCallback(
    (region: ConstraintRegion) => {
      updateWall({ constraints: [...wall.constraints, region] });
      setSelectedConstraintId(region.id);
      setSelectedInventoryId(null);
      setToolMode("select");
    },
    [updateWall, wall.constraints],
  );

  const onConstraintDelete = useCallback(() => {
    if (!selectedConstraintId) return;
    updateWall({ constraints: wall.constraints.filter((c) => c.id !== selectedConstraintId) });
    setSelectedConstraintId(null);
  }, [selectedConstraintId, updateWall, wall.constraints]);

  const handleBackdropUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === "string" ? reader.result : undefined;
        if (!url) return;
        const img = new window.Image();
        img.onload = () => {
          updateWall({
            backdropUrl: url,
            backdropNaturalWidth: img.naturalWidth,
            backdropNaturalHeight: img.naturalHeight,
          });
        };
        img.src = url;
      };
      reader.readAsDataURL(file);
    },
    [updateWall],
  );

  const scalePercent = Math.round(viewport.scale * 100);

  const zoomFocal = useCallback(
    (factor: number) => {
      zoomBy(factor, 400, 300, RULER_THICKNESS_PX, RULER_THICKNESS_PX);
    },
    [zoomBy],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (selectedInventoryId && toolMode !== "constraint") {
        const step = e.shiftKey ? 12 : 6;
        if (e.key === "Escape") {
          setSelectedInventoryId(null);
          return;
        }
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          const block = wall.blocks.find((b) => b.id === selectedInventoryId);
          if (!block) return;
          const patch: Partial<InventoryBlock> = {};
          if (e.key === "ArrowLeft") patch.x = block.x - step;
          if (e.key === "ArrowRight") patch.x = block.x + step;
          if (e.key === "ArrowUp") patch.y = block.y - step;
          if (e.key === "ArrowDown") patch.y = block.y + step;
          onBlockChange(selectedInventoryId, patch);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBlockChange, selectedInventoryId, toolMode, wall.blocks]);

  const statusHint = (
    <p className="rounded-md bg-black/55 px-3 py-1.5 text-center text-[10px] text-white/90">
      {toolMode === "constraint"
        ? "Click to place points · click first point to close · Enter finalize · Esc cancel"
        : "Scroll zoom · Pan (H) · V select · I inventory · C constraint"}
    </p>
  );

  return (
    <>
      <SpatialWorkspaceShell
        workspaceId="advertising"
        title={wall.name}
        subtitle={`${wall.width_inches}" × ${wall.height_inches}" wall`}
        activeToolId={toolMode}
        onToolChange={onToolChange}
        className="-mx-3 -mt-4 min-h-0 w-auto max-w-none lg:-mx-4"
        headerActions={<AdvertisingWorkspaceHeader unit={unit} onUnitChange={setUnit} />}
        leftPanel={
          <WallLayoutPicker
            walls={walls}
            wallId={wallId}
            hasBackdrop={Boolean(wall.backdropUrl)}
            draftConstraintType={draftConstraintType}
            onDraftConstraintTypeChange={setDraftConstraintType}
            onWallChange={(id) => {
              setWallId(id);
              setSelectedInventoryId(null);
              setSelectedConstraintId(null);
              resetView();
            }}
            onBackdropUpload={handleBackdropUpload}
            onClearBackdrop={() =>
              updateWall({ backdropUrl: undefined, backdropNaturalWidth: undefined, backdropNaturalHeight: undefined })
            }
          />
        }
        rightPanel={
          selectedConstraint ? (
            <ConstraintDetailsPanel
              constraint={selectedConstraint}
              onUpdate={(patch) => onConstraintChange(selectedConstraint.id, patch)}
              onDelete={onConstraintDelete}
            />
          ) : (
            <InventoryDetailsPanel
              block={selectedInventory}
              unit={unit}
              onUpdate={(patch) => {
                if (selectedInventoryId) onBlockChange(selectedInventoryId, patch);
              }}
            />
          )
        }
        viewport={
          <InventoryPlannerCanvas
            wall={wall}
            blocks={wall.blocks}
            constraints={wall.constraints}
            toolMode={toolMode}
            draftConstraintType={draftConstraintType}
            selectedInventoryId={selectedInventoryId}
            selectedConstraintId={selectedConstraintId}
            unit={unit}
            viewport={viewport}
            onViewportChange={setViewport}
            snapEnabled={snapEnabled}
            showGrid={showGrid}
            onSelectInventory={setSelectedInventoryId}
            onSelectConstraint={setSelectedConstraintId}
            onBlockChange={onBlockChange}
            onConstraintCreate={onConstraintCreate}
            onConstraintPointsChange={onConstraintPointsChange}
            onDimensionBadgeClick={(id, focus) => setDimEdit({ id, focus })}
            showFloatingHints={false}
            className="h-full w-full"
          />
        }
        floatingControls={
          <SpatialViewportControls
            scalePercent={scalePercent}
            onZoomIn={() => zoomFocal(1.12)}
            onZoomOut={() => zoomFocal(0.88)}
            onResetView={resetView}
            snapEnabled={snapEnabled}
            onSnapToggle={() => setSnapEnabled((v) => !v)}
            showGrid={showGrid}
            onGridToggle={() => setShowGrid((v) => !v)}
          />
        }
        statusHint={statusHint}
      />

      {selectedInventory && dimEdit?.id === selectedInventory.id ? (
        <DimensionEditModal
          open
          blockName={selectedInventory.name}
          widthInches={selectedInventory.width_inches}
          heightInches={selectedInventory.height_inches}
          unit={unit}
          initialFocus={dimEdit.focus}
          onClose={() => setDimEdit(null)}
          onApply={(width_inches, height_inches) => onBlockChange(selectedInventory.id, { width_inches, height_inches })}
        />
      ) : null}
    </>
  );
}

function WallLayoutPicker({
  walls,
  wallId,
  hasBackdrop,
  draftConstraintType,
  onDraftConstraintTypeChange,
  onWallChange,
  onBackdropUpload,
  onClearBackdrop,
}: {
  walls: FacilityWallPlan[];
  wallId: string;
  hasBackdrop: boolean;
  draftConstraintType: ConstraintType;
  onDraftConstraintTypeChange: (t: ConstraintType) => void;
  onWallChange: (id: string) => void;
  onBackdropUpload: (file: File) => void;
  onClearBackdrop: () => void;
}) {
  return (
    <div className="p-3">
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

      <div className="mt-4 border-t border-ds-border/80 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Backdrop photo</p>
        <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-ds-border bg-ds-primary/80 px-3 py-4 text-center text-xs text-ds-muted hover:border-[var(--ds-accent)]/50">
          <span>Upload venue wall image</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onBackdropUpload(f);
            }}
          />
        </label>
        {hasBackdrop ? (
          <button type="button" className="mt-2 w-full text-xs text-ds-muted underline hover:text-ds-foreground" onClick={onClearBackdrop}>
            Remove backdrop
          </button>
        ) : null}
      </div>

      <div className="mt-4 border-t border-ds-border/80 pt-4">
        <label className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">New constraint type</label>
        <select
          className="mt-2 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
          value={draftConstraintType}
          onChange={(e) => onDraftConstraintTypeChange(e.target.value as ConstraintType)}
        >
          <option value="blocked">Blocked</option>
          <option value="mountable">Mountable</option>
          <option value="restricted">Restricted</option>
          <option value="premium_visibility">Premium visibility</option>
          <option value="curved_surface">Curved surface</option>
          <option value="electrical_access">Electrical access</option>
        </select>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ds-muted">
        Constraints and inventory use wall inches. Calibration references can be attached when the calibration tool ships.
      </p>
    </div>
  );
}
