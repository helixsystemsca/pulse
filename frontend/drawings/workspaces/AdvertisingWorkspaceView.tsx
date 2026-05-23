"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DimensionEditModal } from "@/modules/communications/advertising-mapper/components/DimensionEditModal";
import { InventoryPlannerCanvas } from "@/modules/communications/advertising-mapper/components/InventoryPlannerCanvas";
import { PlannerMinimap } from "@/modules/communications/advertising-mapper/components/PlannerMinimap";
import { AdvertisingEditorHeader } from "@/modules/communications/advertising-mapper/components/editor/AdvertisingEditorHeader";
import { AdvertisingFloatingToolbar } from "@/modules/communications/advertising-mapper/components/editor/AdvertisingFloatingToolbar";
import {
  AdvertisingInspectorPanel,
  type AdvertisingLayerVisibility,
} from "@/modules/communications/advertising-mapper/components/editor/AdvertisingInspectorPanel";
import { AdvertisingWallStrip } from "@/modules/communications/advertising-mapper/components/editor/AdvertisingWallStrip";
import { persistAllWallBackdrops } from "@/modules/communications/advertising-mapper/lib/advertising-wall-backdrop-storage";
import { SnipPresetBar } from "@/modules/communications/advertising-mapper/components/editor/SnipPresetBar";
import { snipRegionFromBackdrop, type WallSnipRect } from "@/modules/communications/advertising-mapper/lib/ad-snip";
import { generateEmptySpaceBackdrop } from "@/modules/communications/advertising-mapper/lib/generate-empty-backdrop";
import {
  AD_SIZE_PRESETS,
  DEFAULT_AD_SIZE_PRESET,
  type StandardAdSizePresetId,
} from "@/modules/communications/advertising-mapper/lib/standard-ad-sizes";
import { getDefaultAdvertisingWallScaffolds } from "@/modules/communications/advertising-mapper/data/mock-walls";
import { AdvertisingViewportTitle } from "@/modules/communications/advertising-mapper/components/editor/AdvertisingViewportTitle";
import type { ConstraintRegion, ConstraintType, PlannerToolMode } from "@/modules/communications/advertising-mapper/geometry/types";
import { useAdvertisingOperationalContext } from "@/modules/communications/advertising-mapper/hooks/useAdvertisingOperationalContext";
import { useAdvertisingSpatialRuntime } from "@/modules/communications/advertising-mapper/hooks/useAdvertisingSpatialRuntime";
import { usePlannerViewport } from "@/modules/communications/advertising-mapper/hooks/usePlannerViewport";
import { RULER_THICKNESS_PX } from "@/modules/communications/advertising-mapper/lib/coordinates";
import {
  rescaleWallPlanToInches,
} from "@/modules/communications/advertising-mapper/lib/wall-workable-area";
import {
  drawableInchesFromContainer,
  viewportAt100Percent,
} from "@/modules/communications/advertising-mapper/lib/viewport-at-100";
import type {
  DimensionEditTarget,
  FacilityWallPlan,
  InventoryBlock,
  MeasurementUnit,
} from "@/modules/communications/advertising-mapper/types";
import { BASE_PX_PER_INCH } from "@/modules/communications/advertising-mapper/lib/coordinates";
import { pulseAppHref } from "@/lib/pulse-app";
import {
  getSpatialWorkspace,
  spatialWorkspaceFullscreenHref,
  SpatialViewportControls,
  SpatialWorkspaceShell,
  useSpatialWorkspaceTools,
} from "@/spatial-engine/workspace";
import { useSpatialRuntimeStore } from "@/spatial-engine/runtime/spatial-runtime-store";

const FALLBACK_WALL = getDefaultAdvertisingWallScaffolds()[0]!;

export function AdvertisingWorkspaceView({
  workspaceSwitcher,
  immersive = true,
  editorFullscreen = false,
}: {
  workspaceSwitcher?: ReactNode;
  immersive?: boolean;
  /** True when mounted under `/drawings/fullscreen` — fills viewport without app chrome offset. */
  editorFullscreen?: boolean;
}) {
  const {
    walls,
    wallId,
    wall: wallDoc,
    setWallId,
    onBlockChange,
    onConstraintChange,
    onConstraintCreate,
    onConstraintDelete,
    addBlock,
    removeBlock,
    updateWall,
    addWall,
  } = useAdvertisingSpatialRuntime("left");

  const wall = wallDoc ?? FALLBACK_WALL;
  const undo = useSpatialRuntimeStore((s) => s.undo);
  const redo = useSpatialRuntimeStore((s) => s.redo);

  useAdvertisingOperationalContext(wall);

  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [selectedConstraintId, setSelectedConstraintId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<PlannerToolMode>("select");
  const [draftConstraintType] = useState<ConstraintType>("mountable");
  const [unit, setUnit] = useState<MeasurementUnit>("ft");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [dimEdit, setDimEdit] = useState<{ id: string; focus: DimensionEditTarget } | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<AdvertisingLayerVisibility>({
    backdrop: true,
    constraints: false,
    inventory: true,
  });
  const [snipDraft, setSnipDraft] = useState<WallSnipRect | null>(null);
  const [pendingSnip, setPendingSnip] = useState<WallSnipRect | null>(null);
  const [snipBusy, setSnipBusy] = useState(false);
  const [backdropBusy, setBackdropBusy] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const { viewport, setViewport, zoomBy, resetView } = usePlannerViewport();
  const workspace = getSpatialWorkspace("advertising");

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

  const resetViewportTo100 = useCallback(() => {
    setViewport(viewportAt100Percent());
  }, [setViewport]);

  const syncWallToViewport = useCallback(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const target = drawableInchesFromContainer(rect.width, rect.height);
    const sameSize =
      Math.abs(wall.width_inches - target.width_inches) < 0.05 &&
      Math.abs(wall.height_inches - target.height_inches) < 0.05;
    if (!sameSize) {
      updateWall({
        ...rescaleWallPlanToInches(wall, target.width_inches, target.height_inches),
      });
    }
    resetViewportTo100();
  }, [resetViewportTo100, updateWall, wall]);

  const handleBackdropChange = useCallback(
    (patch: {
      backdropUrl?: string;
      backdropNaturalWidth?: number;
      backdropNaturalHeight?: number;
      width_inches?: number;
      height_inches?: number;
    }) => {
      const el = canvasContainerRef.current;
      if (!el) {
        updateWall(patch);
        resetViewportTo100();
        return;
      }
      const rect = el.getBoundingClientRect();
      const target = drawableInchesFromContainer(rect.width, rect.height);
      updateWall({
        ...patch,
        ...rescaleWallPlanToInches(wall, target.width_inches, target.height_inches),
      });
      resetViewportTo100();
    },
    [resetViewportTo100, updateWall, wall],
  );

  useEffect(() => {
    requestAnimationFrame(() => syncWallToViewport());
  }, [wallId, syncWallToViewport]);

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        requestAnimationFrame(() => syncWallToViewport());
      }, 120);
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [syncWallToViewport]);

  const onConstraintPointsChange = useCallback(
    (id: string, points: number[]) => {
      onConstraintChange(id, { points });
    },
    [onConstraintChange],
  );

  const handleConstraintCreate = useCallback(
    (region: ConstraintRegion) => {
      onConstraintCreate(region);
      setSelectedConstraintId(region.id);
      setSelectedInventoryId(null);
      setToolMode("select");
      setSelectedConstraintId(null);
    },
    [onConstraintCreate],
  );

  const handleConstraintDelete = useCallback(() => {
    if (!selectedConstraintId) return;
    onConstraintDelete(selectedConstraintId);
    setSelectedConstraintId(null);
  }, [onConstraintDelete, selectedConstraintId]);

  const handleBlockDelete = useCallback(
    (id: string) => {
      const block = wall.blocks.find((b) => b.id === id);
      const label = block?.inventoryId ?? block?.name ?? "this item";
      if (!window.confirm(`Remove ${label} from ${wall.name}? This cannot be undone.`)) return;
      removeBlock(id);
      if (selectedInventoryId === id) setSelectedInventoryId(null);
    },
    [removeBlock, selectedInventoryId, wall.blocks, wall.name],
  );

  const handleInventoryPlace = useCallback(
    (x: number, y: number) => {
      const preset = AD_SIZE_PRESETS[DEFAULT_AD_SIZE_PRESET];
      const id = `inv-${Date.now()}`;
      const nextIndex = wall.blocks.length + 1;
      const block: InventoryBlock = {
        id,
        name: `Plot ${nextIndex}`,
        x: Math.max(0, x - preset.widthInches / 2),
        y: Math.max(0, y - preset.heightInches / 2),
        width_inches: preset.widthInches,
        height_inches: preset.heightInches,
        status: "available",
        zone: wall.name,
        visibilityTier: "standard",
        priceTier: "tier_b",
        inventoryId: `S-${String(100 + nextIndex)}`,
        mountingType: "Wall mount",
        sizePreset: DEFAULT_AD_SIZE_PRESET,
        locationLabel: `${wall.name} · open plot`,
      };
      addBlock(block);
      setSelectedInventoryId(id);
      setToolMode("select");
    },
    [addBlock, wall.blocks.length, wall.name],
  );

  const handleSnipConfirm = useCallback(
    async (preset: StandardAdSizePresetId) => {
      if (!pendingSnip) return;
      setSnipBusy(true);
      try {
        const size = AD_SIZE_PRESETS[preset];
        const assetUrl = await snipRegionFromBackdrop(wall, pendingSnip);
        const cx = pendingSnip.x + pendingSnip.width / 2;
        const cy = pendingSnip.y + pendingSnip.height / 2;
        const id = `inv-${Date.now()}`;
        const nextIndex = wall.blocks.length + 1;
        const block: InventoryBlock = {
          id,
          name: `Snipped ad ${nextIndex}`,
          x: Math.max(0, Math.min(wall.width_inches - size.widthInches, cx - size.widthInches / 2)),
          y: Math.max(0, Math.min(wall.height_inches - size.heightInches, cy - size.heightInches / 2)),
          width_inches: size.widthInches,
          height_inches: size.heightInches,
          status: "occupied",
          zone: wall.name,
          visibilityTier: "standard",
          priceTier: "tier_b",
          inventoryId: `S-${String(100 + nextIndex)}`,
          mountingType: "Wall mount",
          assetUrl,
          sizePreset: preset,
          locationLabel: `${wall.name} · snipped`,
          contractStructure: "annual",
        };
        addBlock(block);
        setSelectedInventoryId(id);
        setPendingSnip(null);
        setSnipDraft(null);
        setToolMode("select");
      } catch (e) {
        console.error(e);
        window.alert(e instanceof Error ? e.message : "Could not snip ad from photo.");
      } finally {
        setSnipBusy(false);
      }
    },
    [addBlock, pendingSnip, wall],
  );

  const handleGenerateEmptyBackdrop = useCallback(async () => {
    setBackdropBusy(true);
    try {
      const patch = await generateEmptySpaceBackdrop(wall);
      updateWall(patch);
      resetViewportTo100();
    } catch (e) {
      console.error(e);
      window.alert(e instanceof Error ? e.message : "Could not generate backdrop.");
    } finally {
      setBackdropBusy(false);
    }
  }, [resetViewportTo100, updateWall, wall]);

  const scalePercent = Math.round(viewport.scale * 100);

  const canPanViewport = toolMode === "pan";
  const canZoomViewport = toolMode === "zoom";

  const zoomFocal = useCallback(
    (factor: number) => {
      if (!canZoomViewport) return;
      zoomBy(factor, 400, 300, RULER_THICKNESS_PX, RULER_THICKNESS_PX);
    },
    [canZoomViewport, zoomBy],
  );

  const viewportWorld = useMemo(() => {
    const el = canvasContainerRef.current;
    const w = el?.clientWidth ?? 800;
    const h = el?.clientHeight ?? 520;
    const viewW = (w - RULER_THICKNESS_PX) / (BASE_PX_PER_INCH * viewport.scale);
    const viewH = (h - RULER_THICKNESS_PX) / (BASE_PX_PER_INCH * viewport.scale);
    const x = -viewport.panX / (BASE_PX_PER_INCH * viewport.scale);
    const y = -viewport.panY / (BASE_PX_PER_INCH * viewport.scale);
    return { x: Math.max(0, x), y: Math.max(0, y), width: viewW, height: viewH };
  }, [viewport]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (selectedInventoryId && toolMode !== "constraint") {
        const step = e.shiftKey ? 12 : 6;
        if (e.key === "Escape") {
          if (pendingSnip) {
            setPendingSnip(null);
            setSnipDraft(null);
            return;
          }
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
  }, [onBlockChange, pendingSnip, selectedInventoryId, toolMode, wall.blocks]);

  const wallMeta = useMemo(() => {
    const total = wall.blocks.length;
    const available = wall.blocks.filter((b) => b.status === "available").length;
    const occupied = wall.blocks.filter((b) => b.status === "occupied" || b.status === "reserved").length;
    return { total, available, occupied };
  }, [wall.blocks]);

  const advertisingFullscreenHref = pulseAppHref(spatialWorkspaceFullscreenHref("advertising"));

  const advertisingToolbar = (
    <AdvertisingFloatingToolbar
      tools={workspace.tools}
      activeToolId={toolMode}
      onToolChange={onToolChange}
      snapEnabled={snapEnabled}
      onSnapToggle={() => setSnapEnabled((v) => !v)}
      onUndo={undo}
      onRedo={redo}
      scalePercent={scalePercent}
      onZoomIn={() => zoomFocal(1.12)}
      onZoomOut={() => zoomFocal(0.88)}
      zoomDisabled={!canZoomViewport}
      variant={editorFullscreen ? "floating" : "header"}
    />
  );

  const handleSaveBackdrops = useCallback(() => {
    try {
      const { savedCount } = persistAllWallBackdrops(walls);
      setSaveNotice(
        savedCount > 0
          ? `Saved ${savedCount} background photo${savedCount === 1 ? "" : "s"} in this browser.`
          : "No background photos to save yet. Upload a photo per wall view first.",
      );
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not save background photos.");
    }
  }, [walls]);

  useEffect(() => {
    if (!saveNotice) return;
    const t = window.setTimeout(() => setSaveNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [saveNotice]);

  return (
    <>
      <SpatialWorkspaceShell
        workspaceId="advertising"
        title="Advertising"
        subtitle={`${wallMeta.total} inventory · ${wallMeta.available} available · ${wallMeta.occupied} occupied`}
        activeToolId={toolMode}
        onToolChange={onToolChange}
        workspaceSwitcher={editorFullscreen ? undefined : workspaceSwitcher}
        immersive={immersive}
        fullscreen={editorFullscreen}
        bareEditor={editorFullscreen}
        className={editorFullscreen ? "h-[100dvh]" : "min-h-0 flex-1"}
        headerCenter={
          editorFullscreen ? undefined : (
            <>
              <AdvertisingViewportTitle
                name={wall.name}
                variant="header"
                onRename={(next) => updateWall({ name: next })}
              />
              {advertisingToolbar}
            </>
          )
        }
        headerActions={
          editorFullscreen ? undefined : (
            <AdvertisingEditorHeader
              unit={unit}
              onUnitChange={setUnit}
              onSave={handleSaveBackdrops}
              onPublish={() => {
                /* proposal export — API phase */
              }}
              fullscreenHref={advertisingFullscreenHref}
            />
          )
        }
        floatingToolbarInsetTop={editorFullscreen ? RULER_THICKNESS_PX + 8 : undefined}
        floatingToolbar={editorFullscreen ? advertisingToolbar : undefined}
        rightPanel={
          <AdvertisingInspectorPanel
            wall={wall}
            unit={unit}
            selectedInventoryId={selectedInventoryId}
            onSelectInventory={(id) => {
              setSelectedInventoryId(id);
              setSelectedConstraintId(null);
            }}
            onBlockChange={onBlockChange}
            onBlockDelete={handleBlockDelete}
          />
        }
        viewport={
          <div ref={canvasContainerRef} className="relative h-full w-full">
            {editorFullscreen ? (
              <div
                className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2"
                style={{ top: RULER_THICKNESS_PX + 12 }}
              >
                <AdvertisingViewportTitle
                  name={wall.name}
                  variant="overlay"
                  onRename={(next) => updateWall({ name: next })}
                />
              </div>
            ) : null}
            {saveNotice ? (
              <p
                className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-lg border border-slate-200/90 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-md"
                role="status"
              >
                {saveNotice}
              </p>
            ) : null}
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
              showBackdrop={layerVisibility.backdrop}
              showInventory={layerVisibility.inventory}
              onSelectInventory={setSelectedInventoryId}
              onSelectConstraint={setSelectedConstraintId}
              onBlockChange={onBlockChange}
              onConstraintCreate={handleConstraintCreate}
              onConstraintPointsChange={onConstraintPointsChange}
              onConstraintDelete={(id) => {
                onConstraintDelete(id);
                if (selectedConstraintId === id) setSelectedConstraintId(null);
              }}
              onDimensionBadgeClick={(id, focus) => setDimEdit({ id, focus })}
              onInventoryPlace={handleInventoryPlace}
              snipDraftRect={snipDraft}
              onSnipDraftChange={setSnipDraft}
              onSnipRegionReady={(rect) => {
                setPendingSnip(rect);
                setSnipDraft(null);
              }}
              showFloatingHints={false}
              showMinimap={false}
              editorLightMode
              className="h-full w-full"
            />
            {pendingSnip ? (
              <SnipPresetBar
                busy={snipBusy}
                onConfirm={(preset) => void handleSnipConfirm(preset)}
                onCancel={() => {
                  setPendingSnip(null);
                  setSnipDraft(null);
                }}
              />
            ) : null}
          </div>
        }
        minimap={
          <PlannerMinimap
            wall={wall}
            blocks={wall.blocks}
            constraints={wall.constraints}
            viewportRect={viewportWorld}
            onNavigate={
              canPanViewport
                ? (wx, wy) => {
                    const el = canvasContainerRef.current;
                    const w = el?.clientWidth ?? 800;
                    const h = el?.clientHeight ?? 520;
                    setViewport({
                      ...viewport,
                      panX: -(wx * BASE_PX_PER_INCH * viewport.scale) + (w - RULER_THICKNESS_PX) / 4,
                      panY: -(wy * BASE_PX_PER_INCH * viewport.scale) + (h - RULER_THICKNESS_PX) / 4,
                    });
                  }
                : undefined
            }
          />
        }
        bottomBar={
          editorFullscreen ? undefined : (
          <AdvertisingWallStrip
            walls={walls}
            activeWallId={wallId}
            unit={unit}
            onWallChange={(id) => {
              setWallId(id);
              setSelectedInventoryId(null);
              setSelectedConstraintId(null);
            }}
            onAddWall={() => {
              const id = addWall();
              setWallId(id);
              setSelectedInventoryId(null);
              setSelectedConstraintId(null);
            }}
            onBackdropChange={handleBackdropChange}
            onGenerateEmptySpace={handleGenerateEmptyBackdrop}
            generateBusy={backdropBusy}
            viewportControls={
              <SpatialViewportControls
                scalePercent={scalePercent}
                onZoomIn={() => zoomFocal(1.12)}
                onZoomOut={() => zoomFocal(0.88)}
                onResetView={canPanViewport || canZoomViewport ? syncWallToViewport : () => {}}
                zoomDisabled={!canZoomViewport}
                fitDisabled={!canPanViewport && !canZoomViewport}
                snapEnabled={snapEnabled}
                onSnapToggle={() => setSnapEnabled((v) => !v)}
                showGrid={showGrid}
                onGridToggle={() => setShowGrid((v) => !v)}
                showZoom={false}
              />
            }
          />
          )
        }
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
