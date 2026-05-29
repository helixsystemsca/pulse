"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
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
  surfaceNav?: ReactNode;
  trailing?: ReactNode;
};

/** CAD-style footer — optional surface strip · metadata (center) · viewport tools (right). */
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
  surfaceNav,
  trailing,
}: AdvertisingEditorStatusBarProps) {
  const wallLength = formatMeasurement(wall.width_inches, unit);
  const wallHeight = formatMeasurement(wall.height_inches, unit);
  const cursorLabel =
    cursorInches != null
      ? `${formatMeasurement(cursorInches.x, unit)}, ${formatMeasurement(cursorInches.y, unit)}`
      : null;

  return (
    <footer
      className={cn(
        "grid h-[40px] shrink-0 items-center gap-2 border-t border-slate-200/80 bg-[#f8fafc]/98 px-2 font-mono text-[11px] text-slate-600 backdrop-blur-sm",
        surfaceNav
          ? "grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto]"
          : "grid-cols-[minmax(0,1fr)_auto]",
      )}
    >
      {surfaceNav ? <div className="flex min-w-0 items-center pl-0.5">{surfaceNav}</div> : null}

      <div className="flex min-w-0 flex-col items-center justify-center gap-0 text-center leading-tight">
        <span className="truncate text-[11px] font-semibold text-slate-800">
          {wall.name} Surface
        </span>
        <span className="tabular-nums text-[10px] text-slate-500">
          {wallLength} × {wallHeight}
          {cursorLabel ? (
            <span className="hidden text-slate-400 lg:inline">
              {" "}
              · {cursorLabel}
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1 pr-0.5">
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
