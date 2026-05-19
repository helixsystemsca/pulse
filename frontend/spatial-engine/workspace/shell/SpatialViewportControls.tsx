"use client";

import type { ComponentType } from "react";
import { Grid3x3, Magnet, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";

export type SpatialViewportControlsProps = {
  scalePercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  snapEnabled?: boolean;
  onSnapToggle?: () => void;
  showGrid?: boolean;
  onGridToggle?: () => void;
  /** When false, zoom cluster is hidden (use a dedicated zoom control elsewhere). */
  showZoom?: boolean;
  zoomDisabled?: boolean;
  fitDisabled?: boolean;
  className?: string;
};

export function SpatialViewportControls({
  scalePercent,
  onZoomIn,
  onZoomOut,
  onResetView,
  snapEnabled,
  onSnapToggle,
  showGrid,
  onGridToggle,
  showZoom = true,
  zoomDisabled = false,
  fitDisabled = false,
  className,
}: SpatialViewportControlsProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-1 rounded-lg border border-ds-border/80 bg-ds-primary/95 p-1 shadow-lg backdrop-blur-sm",
        className,
      )}
    >
      {onGridToggle ? (
        <ToggleChip active={Boolean(showGrid)} onClick={onGridToggle} label="Grid" icon={Grid3x3} />
      ) : null}
      {onSnapToggle ? (
        <ToggleChip active={Boolean(snapEnabled)} onClick={onSnapToggle} label="Snap" icon={Magnet} />
      ) : null}
      {showZoom ? (
        <ZoomCluster
          percent={scalePercent}
          onIn={onZoomIn}
          onOut={onZoomOut}
          onReset={onResetView}
          disabled={zoomDisabled}
        />
      ) : null}
      {!showZoom ? (
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-ds-muted hover:bg-ds-secondary disabled:opacity-40"
          onClick={onResetView}
          disabled={fitDisabled}
          aria-label="Fit to view"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Fit</span>
        </button>
      ) : null}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
        active ? "bg-[var(--ds-accent)]/10 text-ds-foreground" : "text-ds-muted hover:bg-ds-secondary",
      )}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ZoomCluster({
  percent,
  onIn,
  onOut,
  onReset,
  disabled = false,
}: {
  percent: number;
  onIn: () => void;
  onOut: () => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const btnClass = "px-2 py-1 text-ds-muted hover:bg-ds-secondary disabled:pointer-events-none";
  return (
    <div className={cn("flex items-center rounded-md border border-ds-border/60", disabled && "opacity-50")}>
      <button type="button" className={btnClass} onClick={onOut} disabled={disabled} aria-label="Zoom out">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[3rem] border-x border-ds-border/60 px-2 text-center font-mono text-xs text-ds-foreground">
        {percent}%
      </span>
      <button type="button" className={btnClass} onClick={onIn} disabled={disabled} aria-label="Zoom in">
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={cn(btnClass, "border-l border-ds-border/60")} onClick={onReset} disabled={disabled} aria-label="Reset view">
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
