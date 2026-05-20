"use client";

import type { ComponentType } from "react";
import { Grid3x3, Magnet, Minus, Plus, RotateCcw, Save } from "lucide-react";
import type { MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  wallName: string;
  unit: MeasurementUnit;
  onUnitChange: (u: MeasurementUnit) => void;
  scalePercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  snapEnabled: boolean;
  onSnapToggle: () => void;
  showGrid: boolean;
  onGridToggle: () => void;
};

export function PlannerToolbar({
  wallName,
  unit,
  onUnitChange,
  scalePercent,
  onZoomIn,
  onZoomOut,
  onResetView,
  snapEnabled,
  onSnapToggle,
  showGrid,
  onGridToggle,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-border/80 px-4 py-2.5">
      <ToolbarWallLabel wallName={wallName} />
      <ToolbarControls
        unit={unit}
        onUnitChange={onUnitChange}
        scalePercent={scalePercent}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onResetView={onResetView}
        snapEnabled={snapEnabled}
        onSnapToggle={onSnapToggle}
        showGrid={showGrid}
        onGridToggle={onGridToggle}
      />
    </div>
  );
}

function ToolbarWallLabel({ wallName }: { wallName: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Advertisement mapping</p>
      <p className="truncate text-sm font-semibold text-ds-foreground">{wallName}</p>
    </div>
  );
}

function ToolbarControls({
  unit,
  onUnitChange,
  scalePercent,
  onZoomIn,
  onZoomOut,
  onResetView,
  snapEnabled,
  onSnapToggle,
  showGrid,
  onGridToggle,
}: Omit<Props, "wallName">) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <UnitToggle unit={unit} onUnitChange={onUnitChange} />
      <ToggleChip active={showGrid} onClick={onGridToggle} label="Grid" icon={Grid3x3} />
      <ToggleChip active={snapEnabled} onClick={onSnapToggle} label="Snap" icon={Magnet} />
      <ZoomCluster percent={scalePercent} onIn={onZoomIn} onOut={onZoomOut} onReset={onResetView} />
      <button type="button" className={cn(buttonVariants({ intent: "primary", surface: "light" }), "gap-1.5 px-3 py-1.5 text-xs")}>
        <Save className="h-3.5 w-3.5" />
        Save
      </button>
    </div>
  );
}

function UnitToggle({ unit, onUnitChange }: { unit: MeasurementUnit; onUnitChange: (u: MeasurementUnit) => void }) {
  return (
    <div className="flex rounded-lg border border-ds-border bg-ds-secondary/40 p-0.5">
      {(["ft", "in"] as const).map((u) => (
        <button
          key={u}
          type="button"
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-bold uppercase",
            unit === u ? "bg-ds-primary text-ds-foreground shadow-sm" : "text-ds-muted hover:text-ds-foreground",
          )}
          onClick={() => onUnitChange(u)}
        >
          {u}
        </button>
      ))}
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
        "flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold",
        active ? "border-[var(--ds-accent)]/50 bg-[var(--ds-accent)]/10 text-ds-foreground" : "border-ds-border text-ds-muted",
      )}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
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
    <div className="flex items-center rounded-lg border border-ds-border">
      <button type="button" className="px-2 py-1 text-ds-muted hover:bg-ds-secondary" onClick={onOut} aria-label="Zoom out">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[3rem] border-x border-ds-border px-2 text-center font-mono text-xs text-ds-foreground">{percent}%</span>
      <button type="button" className="px-2 py-1 text-ds-muted hover:bg-ds-secondary" onClick={onIn} aria-label="Zoom in">
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="border-l border-ds-border px-2 py-1 text-ds-muted hover:bg-ds-secondary" onClick={onReset} aria-label="Reset view">
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
