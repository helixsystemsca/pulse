"use client";

import type { ReactNode } from "react";
import { formatMeasurement } from "@/modules/communications/advertising-mapper/lib/measurements";
import type { FacilityWallPlan, MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
import { SpatialViewportControls } from "@/spatial-engine/workspace";

export type AdvertisingEditorStatusBarProps = {
  wall: FacilityWallPlan;
  unit: MeasurementUnit;
  scalePercent: number;
  snapEnabled: boolean;
  showGrid: boolean;
  cursorInches?: { x: number; y: number } | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onSnapToggle: () => void;
  onGridToggle: () => void;
  zoomDisabled?: boolean;
  fitDisabled?: boolean;
  trailing?: ReactNode;
};

/** CAD-style status bar — coordinates, dimensions, viewport utilities. */
export function AdvertisingEditorStatusBar({
  wall,
  unit,
  scalePercent,
  snapEnabled,
  showGrid,
  cursorInches,
  onZoomIn,
  onZoomOut,
  onResetView,
  onSnapToggle,
  onGridToggle,
  zoomDisabled,
  fitDisabled,
  trailing,
}: AdvertisingEditorStatusBarProps) {
  const wallLength = formatMeasurement(wall.width_inches, unit);
  const wallHeight = formatMeasurement(wall.height_inches, unit);
  const cursorLabel =
    cursorInches != null
      ? `X ${formatMeasurement(cursorInches.x, unit)} · Y ${formatMeasurement(cursorInches.y, unit)}`
      : null;

  return (
    <footer className="flex h-[40px] shrink-0 items-center gap-3 border-t border-slate-200/80 bg-[#f8fafc]/98 px-3 font-mono text-[11px] text-slate-600 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2 tabular-nums">
        <span className="text-slate-500">Surface</span>
        <span className="font-semibold text-slate-800">{wallLength} × {wallHeight}</span>
      </div>

      <span className="hidden h-3 w-px bg-slate-300 sm:block" aria-hidden />

      <div className="hidden min-w-0 flex-1 items-center gap-2 tabular-nums md:flex">
        {cursorLabel ? (
          <>
            <span className="text-slate-500">Cursor</span>
            <span>{cursorLabel}</span>
          </>
        ) : (
          <span className="text-slate-400">{wall.name}</span>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {trailing}
        <SpatialViewportControls
          className="!border-slate-200/80 !bg-white/85 !p-0.5 !shadow-none"
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
      </div>
    </footer>
  );
}
