"use client";

import type { ComponentType } from "react";
import { Grid3x3, Magnet, Minus, Plus, RotateCcw } from "lucide-react";
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
      <ZoomCluster percent={scalePercent} onIn={onZoomIn} onOut={onZoomOut} onReset={onResetView} />
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
}: {
  percent: number;
  onIn: () => void;
  onOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-ds-border/60">
      <button type="button" className="px-2 py-1 text-ds-muted hover:bg-ds-secondary" onClick={onOut} aria-label="Zoom out">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[3rem] border-x border-ds-border/60 px-2 text-center font-mono text-xs text-ds-foreground">
        {percent}%
      </span>
      <button type="button" className="px-2 py-1 text-ds-muted hover:bg-ds-secondary" onClick={onIn} aria-label="Zoom in">
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="border-l border-ds-border/60 px-2 py-1 text-ds-muted hover:bg-ds-secondary" onClick={onReset} aria-label="Reset view">
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
