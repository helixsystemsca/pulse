"use client";

import { useState, type ReactNode } from "react";
import { ImagePlus, PanelRight } from "lucide-react";
import { formatMeasurement } from "@/modules/communications/advertising-mapper/lib/measurements";
import type { FacilityWallPlan, MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
import { AdvertisingViewportSwitcher } from "@/modules/communications/advertising-mapper/components/editor/AdvertisingViewportSwitcher";
import { WallBackdropStripControl } from "@/modules/communications/advertising-mapper/components/editor/WallBackdropStripControl";
import { SpatialViewportControls } from "@/spatial-engine/workspace";
import { cn } from "@/lib/cn";

type BackdropPatch = {
  backdropUrl?: string;
  backdropNaturalWidth?: number;
  backdropNaturalHeight?: number;
};

export type AdvertisingEditorStatusBarProps = {
  walls: readonly FacilityWallPlan[];
  activeWallId: string;
  wall: FacilityWallPlan;
  unit: MeasurementUnit;
  scalePercent: number;
  snapEnabled: boolean;
  showGrid: boolean;
  inspectorOpen: boolean;
  onInspectorToggle: () => void;
  onWallChange: (id: string) => void;
  onAddWall: () => void;
  onBackdropChange?: (patch: BackdropPatch) => void;
  onGenerateEmptySpace?: () => void | Promise<void>;
  generateBusy?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onSnapToggle: () => void;
  onGridToggle: () => void;
  zoomDisabled?: boolean;
  fitDisabled?: boolean;
  /** Optional cursor / selection readout (center). */
  statusCenter?: ReactNode;
};

/** Thin editor status bar (~38px) — viewports, dimensions, viewport utilities. */
export function AdvertisingEditorStatusBar({
  walls,
  activeWallId,
  wall,
  unit,
  scalePercent,
  snapEnabled,
  showGrid,
  inspectorOpen,
  onInspectorToggle,
  onWallChange,
  onAddWall,
  onBackdropChange,
  onGenerateEmptySpace,
  generateBusy,
  onZoomIn,
  onZoomOut,
  onResetView,
  onSnapToggle,
  onGridToggle,
  zoomDisabled,
  fitDisabled,
  statusCenter,
}: AdvertisingEditorStatusBarProps) {
  const [backdropOpen, setBackdropOpen] = useState(false);
  const wallLength = formatMeasurement(wall.width_inches, unit);
  const wallHeight = formatMeasurement(wall.height_inches, unit);

  return (
    <footer className="relative flex h-[38px] shrink-0 items-center gap-2 border-t border-slate-200/80 bg-[#f8fafc]/95 px-2 backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <AdvertisingViewportSwitcher
          walls={walls}
          activeWallId={activeWallId}
          onWallChange={onWallChange}
          onAddWall={onAddWall}
        />
      </div>

      <div className="hidden min-w-0 flex-1 items-center justify-center gap-3 text-[11px] text-slate-600 md:flex">
        {statusCenter ?? (
          <>
            <span className="font-mono tabular-nums">
              {wallLength} × {wallHeight}
            </span>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <span className="text-slate-500">{wall.name}</span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {onBackdropChange ? (
          <div className="relative">
            <button
              type="button"
              className={cn(
                "flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-slate-600 hover:bg-white/80",
                backdropOpen && "bg-white text-sky-700 ring-1 ring-sky-200/80",
              )}
              onClick={() => setBackdropOpen((v) => !v)}
              aria-expanded={backdropOpen}
              aria-label="Background photo"
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden lg:inline">Photo</span>
            </button>
            {backdropOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close photo menu"
                  onClick={() => setBackdropOpen(false)}
                />
                <div className="absolute bottom-full right-0 z-50 mb-2 w-[min(100vw-2rem,20rem)] rounded-lg border border-slate-200/90 bg-white p-3 shadow-xl">
                  <WallBackdropStripControl
                    wall={wall}
                    onBackdropChange={(patch) => {
                      onBackdropChange(patch);
                      setBackdropOpen(false);
                    }}
                    onGenerateEmptySpace={onGenerateEmptySpace}
                    generateBusy={generateBusy}
                  />
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <SpatialViewportControls
          className="!border-slate-200/80 !bg-white/80 !p-0.5 !shadow-none"
          scalePercent={scalePercent}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onResetView={onResetView}
          snapEnabled={snapEnabled}
          onSnapToggle={onSnapToggle}
          showGrid={showGrid}
          onGridToggle={onGridToggle}
          zoomDisabled={zoomDisabled}
          fitDisabled={fitDisabled}
        />

        <button
          type="button"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-white/80",
            inspectorOpen && "bg-sky-100 text-sky-800 ring-1 ring-sky-200/80",
          )}
          onClick={onInspectorToggle}
          aria-label={inspectorOpen ? "Close inventory panel" : "Open inventory panel"}
          aria-pressed={inspectorOpen}
          title="Inventory panel"
        >
          <PanelRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </footer>
  );
}
